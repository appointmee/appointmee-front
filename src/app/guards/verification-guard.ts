import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of, switchMap } from 'rxjs';
import { authService } from '../services/auth-service';
import { verificacionPendienteService } from '../services/verificacion-pendiente-service';

export const verificationGuard: CanActivateFn = () => {
  const auth = inject(authService);
  const pendiente = inject(verificacionPendienteService);
  const router = inject(Router);

  if (auth.autenticado()) return router.parseUrl('/configuracion');
  if (!pendiente.leer()) return router.parseUrl('/login');

  return auth.estadoVerificacion().pipe(
    switchMap(estado => estado.verificada
      ? auth.completarVerificacion().pipe(map(() => { pendiente.limpiar(); return router.parseUrl('/sucursales'); }))
      : of(true)),
    catchError(() => { pendiente.limpiar(); return of(router.parseUrl('/login')); }),
  );
};
