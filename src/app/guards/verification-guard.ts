import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of, switchMap } from 'rxjs';
import { authService } from '../services/auth-service';
import { verificacionPendienteService } from '../services/verificacion-pendiente-service';
import { destinoDespuesDelLogin } from './login-destination';

export const verificationGuard: CanActivateFn = (route) => {
  const auth = inject(authService);
  const pendiente = inject(verificacionPendienteService);
  const router = inject(Router);
  const returnTo = route.queryParamMap?.get('returnTo') ?? null;

  if (auth.autenticado()) return returnTo ? destinoDespuesDelLogin(router, returnTo) : router.parseUrl('/configuracion');
  if (!pendiente.leer()) return router.parseUrl('/login');

  return auth.estadoVerificacion().pipe(
    switchMap(estado => estado.verificada
      ? auth.completarVerificacion().pipe(map(() => { pendiente.limpiar(); return destinoDespuesDelLogin(router, returnTo); }))
      : of(true)),
    catchError(() => { pendiente.limpiar(); return of(router.parseUrl('/login')); }),
  );
};
