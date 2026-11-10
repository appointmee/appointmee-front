import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';

import { authService } from '../services/auth-service';
import { backendService } from '../services/backend-service';


/**
 * 
 * Este archivo se encarga de gestionar la
 * autenticación de todas las peticiones 
 * HTTP que realiza tu aplicación Angular hacia el backend
 *  
 */

export const authInterceptor: HttpInterceptorFn = (request, next) => {

  const api = inject(backendService);
  const path = new URL(request.url).pathname;

  if (!api.esUrlDelBackend(request.url)) return next(request);

  /// Excluir determinadas rutas del interceptor de autenticacion
  if ([
    '/auth/login',
    '/auth/register',
    '/auth/refresh',
    '/auth/forgot-password',
    '/auth/reset-password',
    '/auth/send-verification',
    '/auth/verify-email',
    '/auth/verification-status',
    '/auth/complete-verification',
    '/usuarios/inicio-sesion',
    '/usuarios/crear',
  ].includes(path)) return next(request);

  const auth = inject(authService);
  const router = inject(Router);
  const token = auth.getAccessToken();

  //esto crea una copia de la peticion y le agrega el heeader con el token
  const withToken = (value: string) => request.clone(
    { setHeaders: { Authorization: `Bearer ${value}` } }
  );


  // se encarga de cerrar la sesion y redirigirlo al login
  const expire = () => {
    auth.limpiarSesion();

    if (router.url.startsWith('/login')) return;
    const activeUrl = router.getCurrentNavigation()?.finalUrl;
    const currentUrl = activeUrl ? router.serializeUrl(activeUrl) : router.url;
    const returnTo = currentUrl.startsWith('/login') || currentUrl.startsWith('/error') ? '/' : currentUrl;
    void router.navigate(['/login'], { queryParams: { returnTo, expired: '1' } });

  };

  //detecta un token vencido, intenta renovarlo y vuelve a ejecutar la request HHTTP
  return next(token ? withToken(token) : request).pipe(
    catchError((error: unknown) => {
      if (
        !(error instanceof HttpErrorResponse)|| 
          error.status !== 401 ||
          (!token && !auth.getRefreshToken()))
          return throwError(() => error);

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
