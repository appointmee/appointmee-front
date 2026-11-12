import { HttpBackend, HttpClient, HttpContext, HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  Observable,
  catchError,
  defer,
  finalize,
  map,
  of,
  shareReplay,
  switchMap,
  tap,
  throwError,
} from 'rxjs';

import type { Tokens, UsuarioSesion, PerfilResponse, MensajeResponse, VerificacionEmailResponse, EstadoVerificacion } from '../models/auth';
import { verificacionPendienteService } from './verificacion-pendiente-service';
import type { RegistroRequest } from '../models/registro';
import type { EstadoRecuperacion } from '../models/restablecer-password';
import { backendService } from './backend-service';
import { SIN_MANEJO_GLOBAL_DE_ERRORES } from '../http/error-handling-context';
import { reservaContextoService } from './reserva-contexto-service';

@Injectable({ providedIn: 'root' })
export class authService {
  private static readonly CLAVE_INICIO_SESION = 'appointmee.sesion-iniciada-en';
  private static readonly VIGENCIA_MAXIMA_SESION_MS = 24 * 60 * 60 * 1000;

  // Dependencias HTTP

  private readonly api = inject(backendService);
  private readonly pendiente = inject(verificacionPendienteService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reservaContexto = inject(reservaContextoService);

  private readonly http = inject(HttpClient);
  // El refresh evita los interceptores para no generar un ciclo de errores 401.
  private readonly refreshHttp = new HttpClient(inject(HttpBackend));


  // Estado interno de la sesión

  private readonly estado = signal<'visitante' | 'restaurando' | 'autenticado'>('visitante');
  private readonly usuario = signal<UsuarioSesion | null>(null);
  private readonly sesionVencida = signal(false);

  private renovacion?: Observable<string>;
  private revision = 0;
  private cerrando = false;
  private expiryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    const sincronizarCierreEnOtraPestana = (event: StorageEvent): void => {
      const seEliminoToken = event.key === 'token' && event.newValue === null;
      const seLimpioStorage = event.key === null;
      if ((!seEliminoToken && !seLimpioStorage) || this.visitante()) return;

      const rutaActual = this.router.url;
      const ruta = rutaActual.split(/[?#]/)[0];
      this.limpiarSesion();
      this.reservaContexto.limpiar();

      if (ruta === '/login' || ruta === '/error') return;
      void this.router.navigate(['/login'], {
        queryParams: { returnTo: rutaActual },
        replaceUrl: true,
      });
    };

    window.addEventListener('storage', sincronizarCierreEnOtraPestana);
    this.destroyRef.onDestroy(() => {
      window.removeEventListener('storage', sincronizarCierreEnOtraPestana);
      if (this.expiryTimer !== null) clearTimeout(this.expiryTimer);
    });
  }


  // Estado disponible para las pantallas y el navbar

  readonly autenticado = computed(() => this.estado() === 'autenticado');
  readonly visitante = computed(() => this.estado() === 'visitante');
  readonly restaurando = computed(() => this.estado() === 'restaurando');
  readonly expirado = this.sesionVencida.asReadonly();
  readonly perfil = this.usuario.asReadonly();

  readonly iniciales = computed(() => {
    const partes = (this.usuario()?.email?.split('@')[0] ?? '').split(/[._+\s-]+/).filter(Boolean);
    return (
      (partes.length > 1
        ? partes[0]!.charAt(0) + partes[1]!.charAt(0)
        : partes[0]?.slice(0, 2)
      )?.toUpperCase() || 'AM'
    );
  });


  // Tokens y roles

  getAccessToken(): string | null {
    return localStorage.getItem('token');
  }


  getRefreshToken(): string | null {
    return localStorage.getItem('refreshToken');
  }


  tieneAlgunRol(...roles: string[]): boolean {
    return !!this.usuario()?.roles.some((rol) => roles.includes(rol));
  }


  // Inicio de sesión

  login(email: string, password: string): Observable<void> {
    return defer(() => {
      this.revision++;
      const revision = this.revision;

      return this.http.post<Tokens>(`${this.api.baseUrl}/auth/login`, { email, pass: password }).pipe(
        tap((tokens) => {
          if (revision !== this.revision) throw new Error('Operación de sesión cancelada');

          this.guardarTokens(tokens);
          this.iniciarVigenciaSesion();

          localStorage.setItem('email', email.trim().toLowerCase());
        }),

        switchMap(() => this.validarToken()),

        map(() => undefined),
        catchError((error) => {
          if (revision === this.revision) this.limpiarSesion();
          return throwError(() => error);
        }),
      );
    });
  }


  registrar(datos: RegistroRequest): Observable<MensajeResponse> {
    return this.http.post<MensajeResponse>(`${this.api.baseUrl}/auth/register`, datos);
  }


  solicitarRecuperacion(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.api.baseUrl}/auth/forgot-password`, { email });
  }

  restablecerPassword(token: string, newPassword: string): Observable<MensajeResponse> {
    return this.http.post<MensajeResponse>(`${this.api.baseUrl}/auth/reset-password`, { token, newPassword }).pipe(
      tap(() => {
        this.limpiarSesion();
        this.pendiente.limpiar();
      }),
    );
  }

  validarEnlaceRecuperacion(token: string): Observable<EstadoRecuperacion> {
    return this.http.post<EstadoRecuperacion>(`${this.api.baseUrl}/auth/reset-password/validate`, { token });
  }

  cambiarPassword(currentPassword: string, newPassword: string): Observable<MensajeResponse> {
    return this.http.post<MensajeResponse>(`${this.api.baseUrl}/auth/change-password`,
      { currentPassword, newPassword },
      { context: new HttpContext().set(SIN_MANEJO_GLOBAL_DE_ERRORES, true) },
    ).pipe(tap(() => {
      this.limpiarSesion();
      this.pendiente.limpiar();
    }));
  }




  // Verificación de la cuenta (endpoints públicos)

  estadoVerificacion(): Observable<EstadoVerificacion> {
    const contexto = this.pendiente.leer();
    return this.http.post<EstadoVerificacion>(`${this.api.baseUrl}/auth/verification-status`,
      { email: contexto?.email }, { headers: this.cabeceraVerificacion() }).pipe(
      map(estado => this.validarEstadoVerificacion(estado)),
      tap(estado => this.pendiente.aplicarEstado(estado)),
    );
  }


  solicitarVerificacion(email: string, reenviar = true): Observable<EstadoVerificacion> {
    return this.http.post<EstadoVerificacion>(`${this.api.baseUrl}/auth/send-verification`,
      { email, reenviar }, { headers: this.cabeceraVerificacion() }).pipe(
      map(estado => this.validarEstadoVerificacion(estado)),
    );
  }


  verificarEmail(email: string, codigo: string): Observable<VerificacionEmailResponse> {
    const ticket = this.pendiente.leer()?.verificationToken;
    const revision = this.revision;

    return this.http.post<VerificacionEmailResponse>(`${this.api.baseUrl}/auth/verify-email`,
      { email, codigo }, { headers: this.cabeceraVerificacion() }).pipe(
      map(respuesta => this.validarRespuestaVerificacion(respuesta)),
      catchError(error => {
        // Si se perdió la respuesta, consultar la verdad del servidor antes de decir que falló el código.
        if (![0, 200, 409].includes(error.status) && error.status < 500) return throwError(() => error);
        return this.estadoVerificacion().pipe(
          catchError(cause => throwError(() => cause.status === 401 ? cause : error)),
          switchMap(estado => estado.verificada
            ? this.completarVerificacionHttp().pipe(catchError(() => throwError(() =>
                Object.assign(new HttpErrorResponse({ status: 503 }), { code: 'VERIFICATION_SESSION_FAILED' }))))
            : throwError(() => error)),
        );
      }),
      tap(respuesta => this.guardarSesionVerificada(respuesta, email, ticket, revision)),
    );
  }


  completarVerificacion(): Observable<VerificacionEmailResponse> {
    const contexto = this.pendiente.leer();
    const revision = this.revision;
    return this.completarVerificacionHttp().pipe(
      tap(respuesta => this.guardarSesionVerificada(respuesta, contexto?.email ?? '', contexto?.verificationToken, revision)),
    );
  }


  private completarVerificacionHttp(): Observable<VerificacionEmailResponse> {
    return this.http.post<VerificacionEmailResponse>(`${this.api.baseUrl}/auth/complete-verification`,
      { email: this.pendiente.leer()?.email }, { headers: this.cabeceraVerificacion() }).pipe(
      map(respuesta => this.validarRespuestaVerificacion(respuesta)),
    );
  }


  private cabeceraVerificacion(): Record<string, string> {
    return { 'X-Verification-Token': this.pendiente.leer()?.verificationToken ?? '' };
  }

  private validarEstadoVerificacion(estado: EstadoVerificacion): EstadoVerificacion {
    if (!estado || typeof estado.verificada !== 'boolean' || typeof estado.enviado !== 'boolean'
      || typeof estado.enviadoAhora !== 'boolean' || !Number.isFinite(estado.retryAfterSeconds)
      || estado.retryAfterSeconds < 0 || !Number.isInteger(estado.attemptsRemaining)
      || estado.attemptsRemaining < 0 || estado.attemptsRemaining > 5
      || !Number.isFinite(estado.expiresInSeconds) || estado.expiresInSeconds < 0) {
      throw new HttpErrorResponse({ status: 502 });
    }
    return estado;
  }

  private validarRespuestaVerificacion(respuesta: VerificacionEmailResponse): VerificacionEmailResponse {
    if (!respuesta || typeof (respuesta.accessToken || respuesta.token) !== 'string' || !(respuesta.accessToken || respuesta.token)
      || typeof respuesta.refreshToken !== 'string' || !respuesta.refreshToken || !Number.isInteger(respuesta.usuario?.id)
      || !Array.isArray(respuesta.usuario.roles) || !respuesta.usuario.roles.every(rol => typeof rol === 'string')) {
      throw new HttpErrorResponse({ status: 502, statusText: 'No se pudo completar la sesión' });
    }
    return respuesta;
  }

  guardarSesionVerificada(respuesta: VerificacionEmailResponse, email: string,
      ticket: string | undefined, revision: number): void {
    if (!ticket || this.pendiente.leer()?.verificationToken !== ticket || this.revision !== revision) {
      throw new HttpErrorResponse({ status: 401 });
    }
    this.revision++;
    this.guardarTokens(respuesta);
    this.iniciarVigenciaSesion();
    localStorage.setItem('email', email);
    this.usuario.set({ ...respuesta.usuario, email });
    this.estado.set('autenticado');
  }


  // Restauración al abrir la aplicación

  inicializar(): Observable<void> {
    if (!this.getAccessToken() && !this.getRefreshToken()) return of(undefined);
    if (this.superoVigenciaMaxima()) {
      this.limpiarSesion(true);
      return of(undefined);
    }
    this.programarExpiracion();
    this.estado.set('restaurando');

    const preparar = this.getAccessToken() ? of(this.getAccessToken()!) : this.renovarSesion();

    return preparar.pipe(
      switchMap(() => this.validarToken()),

      map(() => undefined),
      catchError((error) => {
        if (error?.status === 401) this.limpiarSesion(true);
        this.estado.set('visitante');
        return of(undefined);
      }),
    );
  }


  // Validación y carga del perfil

  validarToken(): Observable<UsuarioSesion> {
    return defer(() => {
      if (this.superoVigenciaMaxima()) {
        this.limpiarSesion(true);
        return throwError(() => new HttpErrorResponse({ status: 401 }));
      }

      const revision = this.revision;

      return this.http.get<PerfilResponse>(`${this.api.baseUrl}/usuarios/me`).pipe(
        map((perfil) => {
          if (revision !== this.revision || this.cerrando)
            throw new Error('Operación de sesión cancelada');

          const usuario = { ...perfil, email: localStorage.getItem('email') };
          this.usuario.set(usuario);
          this.estado.set('autenticado');

          return usuario;
        }),
      );
    });
  }


  // Renovación de tokens

  renovarSesion(): Observable<string> {
    if (this.renovacion) return this.renovacion;

    if (this.superoVigenciaMaxima()) {
      this.limpiarSesion(true);
      return throwError(() => new HttpErrorResponse({ status: 401 }));
    }

    const refreshToken = this.getRefreshToken();
    if (!refreshToken) return throwError(() => new HttpErrorResponse({ status: 401 }));
    const revision = this.revision;

    const request = this.refreshHttp.post<Tokens>(`${this.api.baseUrl}/auth/refresh`, { refreshToken }).pipe(
      map((tokens) => {
        if (revision !== this.revision) throw new Error('Operación de sesión cancelada');

        this.guardarTokens(tokens);

        return this.getAccessToken()!;
      }),

      finalize(() => {
        this.renovacion = undefined;
      }),

      shareReplay({ bufferSize: 1, refCount: false }),
    );

    this.renovacion = request;

    return request;
  }


  // Cierre de sesión en el servidor

  logout(): Observable<void> {
    // Esperamos la renovación pendiente para revocar también el refresh resultante.
    return defer(() =>
      (this.renovacion ?? of(this.getAccessToken())).pipe(
        switchMap(() => {
          this.cerrando = true;
          return this.http.post<void>(`${this.api.baseUrl}/auth/logout`, {});
        }),

        finalize(() => {
          this.reservaContexto.limpiar();
          this.limpiarSesion();
          this.cerrando = false;
        }),
      ),
    );
  }


  // Limpieza local

  limpiarSesion(expirada = false): void {
    this.revision++;

    for (const key of ['token', 'refreshToken', 'email', authService.CLAVE_INICIO_SESION]) {
      localStorage.removeItem(key);
    }
    if (this.expiryTimer !== null) {
      clearTimeout(this.expiryTimer);
      this.expiryTimer = null;
    }

    this.usuario.set(null);
    this.sesionVencida.set(expirada);
    this.estado.set('visitante');
  }


  private iniciarVigenciaSesion(): void {
    localStorage.setItem(authService.CLAVE_INICIO_SESION, String(Date.now()));
    this.sesionVencida.set(false);
    this.programarExpiracion();
  }

  /** Mantiene un límite absoluto de 24 h, aunque se renueven los tokens de acceso. */
  private superoVigenciaMaxima(): boolean {
    const valor = localStorage.getItem(authService.CLAVE_INICIO_SESION);
    // No se puede conocer la antigüedad real de una sesión heredada o corrupta:
    // exigir un nuevo login evita concederle otras 24 horas desde esta visita.
    if (valor === null) return true;

    const inicio = Number(valor);
    if (!Number.isFinite(inicio) || inicio <= 0) return true;

    return Date.now() - inicio >= authService.VIGENCIA_MAXIMA_SESION_MS;
  }

  private programarExpiracion(): void {
    if (this.expiryTimer !== null) clearTimeout(this.expiryTimer);
    const inicio = Number(localStorage.getItem(authService.CLAVE_INICIO_SESION));
    const restante = authService.VIGENCIA_MAXIMA_SESION_MS - (Date.now() - inicio);

    if (restante <= 0) {
      this.expirarPorVigencia();
      return;
    }

    this.expiryTimer = setTimeout(() => this.expirarPorVigencia(), restante);
  }

  private expirarPorVigencia(): void {
    const rutaActual = this.router.url;
    const ruta = rutaActual.split(/[?#]/)[0];
    this.limpiarSesion(true);

    if (ruta === '/login' || ruta === '/error') return;
    void this.router.navigate(['/login'], {
      queryParams: { returnTo: rutaActual, expired: '1' },
      replaceUrl: true,
    });
  }


  private guardarTokens(tokens: Tokens): void {
    const access = tokens.accessToken || tokens.token;

    if (!access || !tokens.refreshToken)
      throw new Error('Respuesta de autenticación incompleta');

    localStorage.setItem('token', access);
    localStorage.setItem('refreshToken', tokens.refreshToken);
  }

  revisionActual(): number {
    return this.revision;
  }
}
