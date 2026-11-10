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
import type { Tokens, UsuarioSesion, PerfilResponse, MensajeResponse, VerificacionEmailResponse } from '../models/auth';
import { verificacionPendienteService } from './verificacion-pendiente-service';
import { backendService } from './backend-service';

@Injectable({ providedIn: 'root' })
export class authService {

  private readonly api = inject(backendService);
  private readonly pendiente = inject(verificacionPendienteService);
  private readonly http = inject(HttpClient);
  private readonly refreshHttp = new HttpClient(inject(HttpBackend));
  private readonly estado = signal<'visitante' | 'restaurando' | 'autenticado'>('visitante');
  private readonly usuario = signal<UsuarioSesion | null>(null);
  private renovacion?: Observable<string>;
  private revision = 0;
  private cerrando = false;
  readonly autenticado = computed(() => this.estado() === 'autenticado');
  readonly visitante = computed(() => this.estado() === 'visitante');
  readonly restaurando = computed(() => this.estado() === 'restaurando');
  readonly perfil = this.usuario.asReadonly();
  
  // esto muestra las iniciales de una persona por ejemplo Gonzalo Lopez => GL
  readonly iniciales = computed(() => {
    
    const partes = (this.usuario()?.email?.split('@')[0] ?? '').split(/[._+\s-]+/).filter(Boolean);
    return (
      (partes.length > 1
        ? partes[0]!.charAt(0) + partes[1]!.charAt(0)
        : partes[0]?.slice(0, 2)
      )?.toUpperCase() || 'AM'
    );
  });


  /* 
  Funcion que se ejecuta al abrir la app. 
  Si hay una sesion abierta (existen el token) la trae,
  en el caso de que no nos vuelve a poner como visitantes
  */


  inicializar(): Observable<void> {

    if (!this.getAccessToken() && !this.getRefreshToken()) return of(undefined);
    
    this.estado.set('restaurando');
    
    const preparar = this.getAccessToken() ? of(this.getAccessToken()!) : this.renovarSesion();

    return preparar.pipe(
      switchMap(() => this.validarToken()),

      map(() => undefined),

      catchError((error) => {
        if (error?.status === 401) this.limpiarSesion();
        this.estado.set('visitante');
        return of(undefined);
      }),
    );
  }


  /*Tokens ------------------------------------------------------------------------------ */


  // Cierre de sesión en el servidor


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



  getAccessToken(): string | null {
    return localStorage.getItem('token');
  }

  //Token para mantener la sesion

  getRefreshToken(): string | null {
    return localStorage.getItem('refreshToken');
  }


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



  // Autenticacion -------------------------------------------------------------------------------

  /**
   * 
   * evita que un login anterior sobrescriba una 
   * sesión más reciente y que un error viejo limpie una sesión nueva.
   *  
   */
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



  solicitarRecuperacion(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.api.baseUrl}/auth/forgot-password`, { email });
  }


  revisionActual(): number {
    return this.revision;
  }


  guardarSesionVerificada(respuesta: VerificacionEmailResponse, email: string,
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

  /*
    Roles --------------------------------------------------------------------------------------
  */

  tieneAlgunRol(...roles: string[]): boolean {
    return !!this.usuario()?.roles.some((rol) => roles.includes(rol));
  }



}
