import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { authService } from '../services/auth-service';
import { destinoDespuesDelLogin } from './login-destination';

// Login es público. Si ya hay sesión, evita mostrar nuevamente el formulario.
export const guestGuard: CanActivateFn = (route) => {
  const auth = inject(authService);
  const router = inject(Router);

  return auth.autenticado()
    ? destinoDespuesDelLogin(router, route.queryParamMap.get('returnTo'))
    : true;
};
