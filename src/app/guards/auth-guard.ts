import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';

import { authService } from '../services/auth-service';

export const authGuard: CanActivateFn = (route, state) => {
  const auth = inject(authService);
  const router = inject(Router);

  // Destino del visitante cuando no tiene una sesión válida

  const login = () => router.createUrlTree(['/login'], { queryParams: { returnTo: state.url } });

  if (!auth.getAccessToken() && !auth.getRefreshToken()) return login();


  // Primero validamos la sesión y después los roles de la ruta.

  return auth.validarToken().pipe(
    map(() => {
      const roles = route.data['roles'] as string[] | undefined;

      return !roles?.length || auth.tieneAlgunRol(...roles)
        ? true
        : router.createUrlTree(['/error'], { queryParams: { status: 403 } });
    }),

    catchError((error: unknown) => {
      const status = (error as { status?: number } | null)?.status;

      if (status === 401) {
        auth.limpiarSesion();
        return of(login());
      }
      
      // Conservamos las credenciales ante errores de red o del servidor.

      return of(router.createUrlTree(['/error'], { queryParams: { status: status ?? 500 } }));
    }),
  );
};
