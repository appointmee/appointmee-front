import { HttpBackend, HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
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
import { backendService } from './backend-service';

@Injectable({ providedIn: 'root' })
export class authService {

  // Dependencias HTTP

  private readonly api = inject(backendService);
  private readonly pendiente = inject(verificacionPendienteService);

  private readonly http = inject(HttpClient);
  // El refresh evita los interceptores para no generar un ciclo de errores 401.
  private readonly refreshHttp = new HttpClient(inject(HttpBackend));


  // Estado interno de la sesión

  private readonly estado = signal<'visitante' | 'restaurando' | 'autenticado'>('visitante');
  private readonly usuario = signal<UsuarioSesion | null>(null);

  private renovacion?: Observable<string>;
  private revision = 0;
  private cerrando = false;


  // Estado disponible para las pantallas y el navbar

  readonly autenticado = computed(() => this.estado() === 'autenticado');
  readonly visitante = computed(() => this.estado() === 'visitante');
  readonly restaurando = computed(() => this.estado() === 'restaurando');
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


  solicitarRecuperacion(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.api.baseUrl}/auth/forgot-password`, { email });
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

  private guardarSesionVerificada(respuesta: VerificacionEmailResponse, email: string,
      ticket: string | undefined, revision: number): void {
    if (!ticket || this.pendiente.leer()?.verificationToken !== ticket || this.revision !== revision) {
      throw new HttpErrorResponse({ status: 401 });
    }
    this.revision++;
    this.guardarTokens(respuesta);
    localStorage.setItem('email', email);
    this.usuario.set({ ...respuesta.usuario, email });
    this.estado.set('autenticado');
  }


  // Restauración al abrir la aplicación

  inicializar(): Observable<void> {
    if (!this.getAccessToken() && !this.getRefreshToken()) return of(undefined);
    this.estado.set('restaurando');

    const preparar = this.getAccessToken() ? of(this.getAccessToken()!) : this.renovarSesion();

    return preparar.pipe(
      switchMap(() => this.validarToken()),

      map(() => undefined),
      catchError((error) => {
        if (error?.status === 401) this.limpiarSesion();
        // Un fallo de conexión no debe borrar un refresh válido.
        this.estado.set('visitante');
        return of(undefined);
      }),
    );
  }


  // Validación y carga del perfil

  validarToken(): Observable<UsuarioSesion> {
    return defer(() => {
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
          this.limpiarSesion();
          this.cerrando = false;
        }),
      ),
    );
  }


  // Limpieza local

  limpiarSesion(): void {
    this.revision++;

    for (const key of ['token', 'refreshToken', 'email']) localStorage.removeItem(key);

    this.usuario.set(null);
    this.estado.set('visitante');
  }


  private guardarTokens(tokens: Tokens): void {
    const access = tokens.accessToken || tokens.token;

    if (!access || !tokens.refreshToken)
      throw new Error('Respuesta de autenticación incompleta');

    localStorage.setItem('token', access);
    localStorage.setItem('refreshToken', tokens.refreshToken);
  }
}
