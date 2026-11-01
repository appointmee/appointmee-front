import { Routes } from '@angular/router';

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
    loadComponent: () => import('./pages/sucursales/sucursales').then((module) => module.Sucursales),
  },
  {
    path: 'listado-sucursales',
    redirectTo: 'sucursales',
  },
  {
    path: 'sucursal/:id',
    title: 'AppointMee | Sucursal',
    data: {
      title: 'Sucursal',
      description: 'Detalle de la sucursal seleccionada.',
    },
    loadComponent: () => import('./pages/section/section').then((module) => module.Section),
  },
  {
    path: 'mis-turnos',
    title: 'AppointMee | Mis Turnos',
    data: {
      title: 'Mis Turnos',
      description: 'Consultá y gestioná todos tus turnos en un solo lugar.',
    },
    loadComponent: () => import('./pages/section/section').then((module) => module.Section),
  },
  {
    path: 'mis-sucursales',
    title: 'AppointMee | Mis Sucursales',
    data: {
      title: 'Mis Sucursales',
      description: 'Explorá las sucursales disponibles y encontrá la más cercana.',
    },
    loadComponent: () => import('./pages/section/section').then((module) => module.Section),
  },
  {
    path: 'perfil',
    title: 'AppointMee | Mi Perfil',
    data: {
      title: 'Mi Perfil',
      description: 'Actualizá tus datos y mantené tu cuenta al día.',
    },
    loadComponent: () => import('./pages/section/section').then((module) => module.Section),
  },
  {
    path: 'solicitudes',
    title: 'AppointMee | Solicitudes',
    data: {
      title: 'Solicitudes',
      description: 'Seguí el estado de tus solicitudes y enterate de las novedades.',
    },
    loadComponent: () => import('./pages/section/section').then((module) => module.Section),
  },
  {
    path: 'configuracion',
    title: 'AppointMee | Ajustes',
    data: {
      title: 'Ajustes',
      description: 'Personalizá tus preferencias y la forma en que usás AppointMee.',
    },
    loadComponent: () => import('./pages/section/section').then((module) => module.Section),
  },
  {
    path: 'error',
    title: 'AppointMee | Algo salió mal',
    loadComponent: () => import('./pages/error/error').then((module) => module.ErrorPage),
  },
  {
    path: 'login',
    title: 'AppointMee | Iniciar sesión',
    loadComponent: () => import('./pages/login/login').then((module) => module.LoginPage),
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
    title: 'AppointMee | Administración',
    data: {
      title: 'Administración',
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
