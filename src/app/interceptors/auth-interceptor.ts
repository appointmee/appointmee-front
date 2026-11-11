import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';

import { authService } from '../services/auth-service';
import { backendService } from '../services/backend-service';
import { esPasswordActualIncorrecta } from '../http/password-change-error';

export const authInterceptor: HttpInterceptorFn = (request, next) => {

  // Las peticiones externas no reciben credenciales.

  const api = inject(backendService);

  if (!api.esUrlDelBackend(request.url)) return next(request);


  // Los endpoints públicos no necesitan access token.

  const path = new URL(request.url).pathname;
  const observabilityEvent = request.method === 'POST' && path === '/observabilidad/error';
  if (observabilityEvent) return next(request);

  const lecturaPublica = request.method === 'GET' && (
    /^\/sucursales\/(listar(?:\/filtrar)?|categorias|\d+(?:\/(elegir-empleado|resenias))?)$/.test(path)
    || /^\/servicios\/(?:listar\/sucursal\/\d+|\d+)$/.test(path)
    || /^\/turnos\/disponibilidad\/empleado\/\d+\/servicio\/\d+$/.test(path)
  );
  if (lecturaPublica) return next(request);

  if (
    [
      '/auth/login',
      '/auth/register',
      '/auth/refresh',
      '/auth/forgot-password',
      '/auth/reset-password',
      '/auth/reset-password/validate',
      '/auth/send-verification',
      '/auth/verify-email',
      '/auth/verification-status',
      '/auth/complete-verification',
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

  const errorDePasswordActual = (error: unknown) => request.method === 'POST'
    && path === '/auth/change-password' && esPasswordActualIncorrecta(error);


  // Volver al login cuando la sesión fue rechazada

  const expire = () => {
    auth.limpiarSesion();
    if (!router.url.startsWith('/login')) {
      // Durante una navegación protegida, router.url todavía puede ser la
      // pantalla anterior. El destino final contiene la ruta que se quiso abrir.
      const activeUrl = router.getCurrentNavigation()?.finalUrl;
      const currentUrl = activeUrl ? router.serializeUrl(activeUrl) : router.url;
      const returnTo = currentUrl.startsWith('/login') || currentUrl.startsWith('/error') ? '/' : currentUrl;
      void router.navigate(['/login'], { queryParams: { returnTo, expired: '1' } });
    }
  };


  // Renovación y reintento de la petición

  return next(token ? withToken(token) : request).pipe(
    catchError((error: unknown) => {
      if (
        !(error instanceof HttpErrorResponse) ||
        errorDePasswordActual(error) ||
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
          if (cause instanceof HttpErrorResponse && cause.status === 401 && !errorDePasswordActual(cause)) expire();
          return throwError(() => cause);
        }),
      );
    }),
  );
};
