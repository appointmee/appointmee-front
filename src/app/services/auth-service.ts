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

import type { Tokens, UsuarioSesion, PerfilResponse } from '../models/auth';
import { backendService } from './backend-service';

@Injectable({ providedIn: 'root' })
export class authService {

  // Dependencias HTTP

  private readonly api = inject(backendService);

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
