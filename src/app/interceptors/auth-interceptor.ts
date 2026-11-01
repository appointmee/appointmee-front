import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';

import { authService } from '../services/auth-service';
import { backendService } from '../services/backend-service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {

  // Las peticiones externas no reciben credenciales.

  const api = inject(backendService);

  if (!api.esUrlDelBackend(request.url)) return next(request);


  // Los endpoints públicos no necesitan access token.

  const path = new URL(request.url).pathname;
  if (
    [
      '/auth/login',
      '/auth/register',
      '/auth/refresh',
      '/auth/forgot-password',
      '/auth/reset-password',
      '/usuarios/inicio-sesion',
      '/usuarios/crear',
    ].includes(path)
  )
    return next(request);


  // Preparación de la petición autenticada

  const auth = inject(authService);
  const router = inject(Router);
  const token = auth.getAccessToken();

  const withToken = (value: string) =>
    request.clone({ setHeaders: { Authorization: `Bearer ${value}` } });


  // Volver al login cuando la sesión fue rechazada

  const expire = () => {
    auth.limpiarSesion();
    if (!router.url.startsWith('/login')) {
      void router.navigate(['/login'], { queryParams: { returnTo: router.url, expired: '1' } });
    }
  };


  // Renovación y reintento de la petición

  return next(token ? withToken(token) : request).pipe(
    catchError((error: unknown) => {
      if (
        !(error instanceof HttpErrorResponse) ||
        error.status !== 401 ||
        (!token && !auth.getRefreshToken())
      ) {
        return throwError(() => error);
      }
      
      // Otra petición puede haber renovado los tokens mientras esta esperaba.
      const current = auth.getAccessToken();

      const retry =
        current && current !== token
          ? next(withToken(current))
          : auth.renovarSesion().pipe(switchMap((access) => next(withToken(access))));

      return retry.pipe(
        catchError((cause: unknown) => {
          if (cause instanceof HttpErrorResponse && cause.status === 401) expire();
          return throwError(() => cause);
        }),
      );
    }),
  );
};
