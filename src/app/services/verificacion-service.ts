import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, switchMap, tap, throwError } from 'rxjs';
import type { EstadoVerificacion, VerificacionEmailResponse } from '../models/auth';
import { authService } from './auth-service';
import { backendService } from './backend-service';
import { verificacionPendienteService } from './verificacion-pendiente-service';

@Injectable({ providedIn: 'root' })
export class verificacionService {

  private readonly api = inject(backendService);
  private readonly pendiente = inject(verificacionPendienteService);
  private readonly http = inject(HttpClient);
  private readonly auth = inject(authService);

  // Verificación de la cuenta por email ----------------------------------------------------------------

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
    const revision = this.auth.revisionActual();

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
      tap(respuesta => this.auth.guardarSesionVerificada(respuesta, email, ticket, revision)),
    );
  }


  completarVerificacion(): Observable<VerificacionEmailResponse> {
    const contexto = this.pendiente.leer();
    const revision = this.auth.revisionActual();
    return this.completarVerificacionHttp().pipe(
      tap(respuesta => this.auth.guardarSesionVerificada(respuesta, contexto?.email ?? '', contexto?.verificationToken, revision)),
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
}
