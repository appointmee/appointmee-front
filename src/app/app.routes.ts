import { Routes } from '@angular/router';
import { authGuard } from './guards/auth-guard';
import { verificationGuard } from './guards/verification-guard';
import { guestGuard } from './guards/guest-guard';

export const routes: Routes = [
  {
    path: '',
    title: 'AppointMee | Inicio',
    loadComponent: () => import('./pages/home/home').then((module) => module.Home),
  },
  {
    path: 'sucursales',
    title: 'AppointMee | Sucursales',
    data: {
      title: 'Sucursales',
      description: 'Explorá las sucursales disponibles y encontrá la más cercana.',
    },
    loadComponent: () =>
      import('./pages/sucursales/sucursales').then((module) => module.Sucursales),
  },
  {
    path: 'listado-sucursales',
    redirectTo: 'sucursales',
  },
  {
    path: 'sucursal/:sucursalId/servicios',
    canActivate: [authGuard],
    title: 'AppointMee | Elegir servicio',
    data: {
      title: 'Elegir servicio',
      description: 'Elegí el servicio que querés reservar en esta sucursal.',
    },
    loadComponent: () =>
      import('./pages/servicios/servicios').then((module) => module.Servicios),
  },
  {
    path: 'servicios',
    title: 'AppointMee | Elegir servicio',
    data: {
      title: 'Elegir servicio',
      description: 'Elegí el servicio que querés reservar en esta sucursal.',
    },
    loadComponent: () =>
      import('./pages/servicios/servicios').then((module) => module.Servicios),
  },
  {
    path: 'sucursal/:id/resenias',
    canActivate: [authGuard],
    title: 'AppointMee | Reseñas',
    loadComponent: () =>
      import('./pages/sucursal-resenias/sucursal-resenias').then(
        (module) => module.SucursalResenias,
      ),
  },
  {
    path: 'sucursal/:id/equipo',
    canActivate: [authGuard],
    title: 'AppointMee | Equipo',
    loadComponent: () =>
      import('./pages/sucursal-equipo/sucursal-equipo').then(
        (module) => module.SucursalEquipo,
      ),
  },
  {
    // El detalle es público: el CTA decide si inicia sesión antes de reservar.
    path: 'sucursal/:id',
    title: 'AppointMee | Sucursal',
    loadComponent: () =>
      import('./pages/sucursal-detalle/sucursal-detalle').then(
        (module) => module.SucursalDetalle,
      ),
  },
  {
    path: 'mis-turnos',
    canActivate: [authGuard],
    title: 'AppointMee | Mis Turnos',
    data: {
      title: 'Mis Turnos',
      description: 'Consultá y gestioná todos tus turnos en un solo lugar.',
    },
    loadComponent: () => import('./pages/section/section').then((module) => module.Section),
  },
  {
    path: 'mis-sucursales',
    canActivate: [authGuard],
    title: 'AppointMee | Mis Sucursales',
    data: {
      title: 'Mis Sucursales',
      roles: ['EMPLEADOR'],
      description: 'Explorá las sucursales disponibles y encontrá la más cercana.',
    },
    loadComponent: () => import('./pages/section/section').then((module) => module.Section),
  },
  {
    path: 'perfil',
    canActivate: [authGuard],
    title: 'AppointMee | Mi Perfil',
    data: {
      title: 'Mi Perfil',
      description: 'Actualizá tus datos y mantené tu cuenta al día.',
    },
    loadComponent: () => import('./pages/section/section').then((module) => module.Section),
  },
  {
    path: 'solicitudes',
    canActivate: [authGuard],
    title: 'AppointMee | Solicitudes',
    data: {
      title: 'Solicitudes',
      description: 'Seguí el estado de tus solicitudes y enterate de las novedades.',
    },
    loadComponent: () => import('./pages/section/section').then((module) => module.Section),
  },
  {
    path: 'configuracion/verificar-email',
    canActivate: [verificationGuard],
    title: 'AppointMee | Ajustes · Verificar cuenta',
    loadComponent: () => import('./pages/configuracion/configuracion').then(module => module.Configuracion),
  },
  {
    path: 'configuracion',
    canActivate: [authGuard],
    title: 'AppointMee | Ajustes',
    loadComponent: () => import('./pages/configuracion/configuracion').then(module => module.Configuracion),
  },
  {
    path: 'error',
    title: 'AppointMee | Algo salió mal',
    loadComponent: () => import('./pages/error/error').then((module) => module.ErrorPage),
  },
  {
    path: 'login',
    canActivate: [guestGuard],
    title: 'AppointMee | Iniciar sesión',
    loadComponent: () => import('./pages/login/login').then((module) => module.LoginPage),
  },
  {
    path: 'reset-password',
    title: 'AppointMee | Restablecer contraseña',
    loadComponent: () => import('./pages/reset-password/reset-password').then(module => module.ResetPasswordPage),
  },
  {
    path: 'olvide-mi-contrasena',
    title: 'AppointMee | Recuperar contraseña',
    loadComponent: () => import('./pages/forgot-password/forgot-password').then(module => module.ForgotPasswordPage),
  },
  {
    path: 'verificar-email',
    redirectTo: 'configuracion/verificar-email',
    pathMatch: 'full',
  },
  {
    path: 'registrarme',
    canActivate: [guestGuard],
    title: 'AppointMee | Crear cuenta',
    loadComponent: () => import('./pages/registrarme/registrarme').then(module => module.Registrarme),
  },
  {
    path: 'admin',
    canActivate: [authGuard],
    title: 'AppointMee | Administración',
    data: {
      title: 'Administración',
      roles: ['ADMINISTRADOR'],
      description: 'Panel interno disponible para usuarios con rol Administrador.',
    },
    loadComponent: () => import('./pages/section/section').then((module) => module.Section),
  },
  {
    path: '**',
    title: 'AppointMee | Página no encontrada',
    loadComponent: () =>
      import('./pages/no-encontrada/no-encontrada').then((module) => module.NotFoundPage),
  },
];
