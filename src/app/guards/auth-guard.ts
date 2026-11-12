import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';

import { authService } from '../services/auth-service';

export const authGuard: CanActivateFn = (route, state) => {
  const auth = inject(authService);
  const router = inject(Router);

  const inicio = () => router.parseUrl('/');
  const tienePermisos = (): boolean => {
    const roles = route.data['roles'] as string[] | undefined;
    const rolesExcluidos = route.data['rolesExcluidos'] as string[] | undefined;
    const cumpleRolesRequeridos = !roles?.length || auth.tieneAlgunRol(...roles);
    const tieneRolExcluido = !!rolesExcluidos?.length && auth.tieneAlgunRol(...rolesExcluidos);

    return cumpleRolesRequeridos && !tieneRolExcluido;
  };

  if (!auth.getAccessToken() && !auth.getRefreshToken()) return inicio();

  // Offline solo se permite continuar con una sesión ya restaurada/validada en
  // memoria y con los roles requeridos. Una sesión desconocida falla de forma segura.
  if (!navigator.onLine) return of(auth.autenticado() && tienePermisos() ? true : inicio());


  // Primero validamos la sesión y después los roles de la ruta. Además de los
  // roles requeridos, una ruta puede excluir roles concretos (por ejemplo,
  // Mis Turnos no está disponible para administradores).

  return auth.validarToken().pipe(
    map(() => {
      return tienePermisos() ? true : inicio();
    }),

    catchError((error: unknown) => {
      const status = (error as { status?: number } | null)?.status;

      if (status === 401) {
        auth.limpiarSesion();
        return of(inicio());
      }

      // Ante un error de red solo se mantiene el acceso si la sesión ya estaba
      // validada en memoria y los roles requeridos siguen disponibles.
      if (status === 0 || status === undefined || status === null) {
        return of(auth.autenticado() && tienePermisos() ? true : inicio());
      }

      // Conservamos las credenciales ante errores de red o del servidor.

      return of(router.createUrlTree(['/error'], { queryParams: { status: status ?? 500, returnTo: state.url } }));
    }),
  );
};
