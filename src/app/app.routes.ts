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
    path: 'sucursal/:id',
    canActivate: [authGuard],
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
    title: 'AppointMee | Crear cuenta',
    data: {
      title: 'Crear cuenta',
      description: 'Creá tu cuenta de AppointMee para reservar y gestionar turnos.',
    },
    loadComponent: () => import('./pages/section/section').then((module) => module.Section),
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
    redirectTo: '',
  },
];
