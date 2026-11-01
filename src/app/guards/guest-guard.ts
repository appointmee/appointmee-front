import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { verificacionPendienteService } from '../services/verificacion-pendiente-service';
import { authService } from '../services/auth-service';
import { destinoDespuesDelLogin } from './login-destination';

// Login es público. Si ya hay sesión, evita mostrar nuevamente el formulario.
export const guestGuard: CanActivateFn = (route) => {
  inject(verificacionPendienteService).limpiar();

  const auth = inject(authService);
  const router = inject(Router);

  return auth.autenticado()
    ? destinoDespuesDelLogin(router, route.queryParamMap.get('returnTo'))
    : true;
};
