import { Routes } from '@angular/router';
import { authGuard } from './guards/auth-guard';
import { verificationGuard } from './guards/verification-guard';
import { guestGuard } from './guards/guest-guard';


/*

  Usamos loadcomponent: en vez de component: porque
  nos permite cargar las cosas solo cuando se necesitan

*/

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
    path: 'sucursal/:sucursalId/servicios/:servicioId/empleados',
    title: 'AppointMee | Elegir empleado',
    data: {
      title: 'Elegir empleado',
      description: 'Elegí al profesional que realizará el servicio reservado.',
    },
    loadComponent: () =>
      import('./pages/elegir-empleado/elegir-empleado').then(
        (module) => module.ElegirEmpleado,
      ),
  },
  {
    path: 'sucursal/:sucursalId/servicios/:servicioId/turnos/pago',
    title: 'AppointMee | Enlace de pago',
    data: {
      title: 'Enlace de pago',
      description: 'Completá el pago para confirmar tu turno.',
    },
    loadComponent: () =>
      import('./pages/pago-turno/pago-turno').then((module) => module.PagoTurno),
  },
  {
    path: 'pago/resultado',
    title: 'AppointMee | Resultado del pago',
    loadComponent: () =>
      import('./pages/resultado-pago/resultado-pago').then(
        (module) => module.ResultadoPago,
      ),
  },
  {
    path: 'sucursal/:sucursalId/servicios/:servicioId/turnos',
    title: 'AppointMee | Seleccionar día y horario',
    data: {
      title: 'Seleccionar día y horario',
      description: 'Elegí el día y el horario disponible para tu turno.',
    },
    loadComponent: () =>
      import('./pages/elegir-turno/elegir-turno').then((module) => module.ElegirTurno),
  },
  {
    path: 'sucursal/:sucursalId/servicios',
    title: 'AppointMee | Seleccionar servicio',
    data: {
      title: 'Seleccionar servicio',
      description: 'Elegí el servicio que querés reservar en esta sucursal.',
    },
    loadComponent: () =>
      import('./pages/servicios/servicios').then((module) => module.Servicios),
  },
  {
    path: 'sucursal/:sucursalId/profesionales',
    canActivate: [authGuard],
    title: 'AppointMee | Elegir profesional',
    data: { title: 'Elegir profesional', description: 'Elegí quién te atenderá.' },
    loadComponent: () =>
      import('./pages/profesionales-reserva/profesionales-reserva').then(
        (module) => module.ProfesionalesReserva,
      ),
  },
  {
    path: 'reserva/confirmada',
    canActivate: [authGuard],
    title: 'AppointMee | Reserva confirmada',
    loadComponent: () =>
      import('./pages/reserva-confirmada/reserva-confirmada').then(
        (module) => module.ReservaConfirmada,
      ),
  },
  {
    path: 'servicios',
    title: 'AppointMee | Seleccionar servicio',
    data: {
      title: 'Seleccionar servicio',
      description: 'Elegí el servicio que querés reservar en esta sucursal.',
    },
    loadComponent: () =>
      import('./pages/servicios/servicios').then((module) => module.Servicios),
  },
  {
    path: 'sucursal/:id/resenias',
    title: 'AppointMee | Reseñas',
    loadComponent: () =>
      import('./pages/sucursal-resenias/sucursal-resenias').then(
        (module) => module.SucursalResenias,
      ),
  },
  {
    path: 'sucursal/:id/equipo',
    title: 'AppointMee | Equipo',
    loadComponent: () =>
      import('./pages/sucursal-equipo/sucursal-equipo').then(
        (module) => module.SucursalEquipo,
      ),
  },
  {
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
      rolesExcluidos: ['ADMINISTRADOR'],
    },
    loadComponent: () =>
      import('./pages/mis-turnos/mis-turnos').then((module) => module.MisTurnos),
  },
  {
    path: 'mis-sucursales',
    canActivate: [authGuard],
    title: 'AppointMee | Mis Sucursales',
    data: {
      title: 'Mis Sucursales',
      roles: ['EMPLEADOR'],
      description: 'Gestioná las sucursales que te pertenecen y sus solicitudes de empleo.',
    },
    loadComponent: () =>
      import('./pages/mis-sucursales/mis-sucursales').then(
        (module) => module.MisSucursales,
      ),
  },
  {
    path: 'mis-sucursales/nueva',
    canActivate: [authGuard],
    title: 'AppointMee | Crear sucursal',
    data: {
      title: 'Crear sucursal',
      roles: ['EMPLEADOR'],
      description: 'Creá una nueva sucursal para gestionarla desde tu panel.',
    },
    loadComponent: () =>
      import('./pages/crear-sucursal/crear-sucursal').then(
        (module) => module.CrearSucursalPage,
      ),
  },
  {
    path: 'mis-sucursales/:sucursalId/empleados',
    canActivate: [authGuard],
    title: 'AppointMee | Empleados de la sucursal',
    data: {
      title: 'Empleados',
      roles: ['EMPLEADOR'],
      description: 'Consultá el equipo de tu sucursal y agregate como empleado.',
    },
    loadComponent: () =>
      import('./pages/empleados-sucursal/empleados-sucursal').then(
        (module) => module.EmpleadosSucursal,
      ),
  },
  {
    path: 'mis-sucursales/:sucursalId/solicitudes',
    canActivate: [authGuard],
    title: 'AppointMee | Solicitudes de la sucursal',
    data: {
      title: 'Solicitudes',
      roles: ['EMPLEADOR'],
      description: 'Enviá y consultá las solicitudes de empleo de tu sucursal.',
    },
    loadComponent: () =>
      import('./pages/solicitudes-sucursal/solicitudes-sucursal').then(
        (module) => module.SolicitudesSucursal,
      ),
  },
  {
    path: 'mis-sucursales/:sucursalId/turnos',
    canActivate: [authGuard],
    title: 'AppointMee | Turnos de la sucursal',
    data: {
      title: 'Turnos de la sucursal',
      roles: ['EMPLEADOR'],
      description: 'Consultá y supervisá el historial de turnos de tu sucursal.',
    },
    loadComponent: () =>
      import('./pages/turnos-sucursal/turnos-sucursal').then(
        (module) => module.TurnosSucursal,
      ),
  },
  {
    path: 'mis-sucursales/:sucursalId/servicios',
    canActivate: [authGuard],
    title: 'AppointMee | Servicios de la sucursal',
    data: {
      title: 'Servicios',
      roles: ['EMPLEADOR'],
      description: 'Administrá los servicios de tu sucursal.',
    },
    loadComponent: () =>
      import('./pages/servicios-sucursal/servicios-sucursal').then(
        (module) => module.ServiciosSucursal,
      ),
  },
  {
    path: 'turnos-asignados',
    canActivate: [authGuard],
    title: 'AppointMee | Turnos asignados',
    data: {
      title: 'Turnos asignados',
      roles: ['EMPLEADO'],
      description: 'Consultá los turnos que tenés asignados en tus sucursales.',
    },
    loadComponent: () =>
      import('./pages/turnos-asignados/turnos-asignados').then(
        (module) => module.TurnosAsignados,
      ),
  },
  {
    path: 'turnos-asignados/:sucursalId',
    canActivate: [authGuard],
    title: 'AppointMee | Turnos asignados de la sucursal',
    data: {
      title: 'Turnos asignados',
      roles: ['EMPLEADO'],
      description: 'Consultá tus turnos asignados en una de tus sucursales.',
    },
    loadComponent: () =>
      import(
        './pages/turnos-asignados-sucursal/turnos-asignados-sucursal'
      ).then((module) => module.TurnosAsignadosSucursal),
  },
  {
    path: 'solicitudes/empleo/enviadas/:sucursalId',
    canActivate: [authGuard],
    title: 'AppointMee | Solicitudes de empleo enviadas',
    data: {
      title: 'Solicitudes de empleo enviadas',
      description: 'Consultá todas las invitaciones de empleo que enviaste.',
    },
    loadComponent: () =>
      import(
        './pages/solicitudes-empleado-enviadas-historial/solicitudes-empleado-enviadas-historial'
      ).then((module) => module.SolicitudesEmpleadoEnviadasHistorial),
  },
  {
    path: 'perfil',
    canActivate: [authGuard],
    title: 'AppointMee | Mi Perfil',
    data: {
      title: 'Mi Perfil',
      description: 'Consultá tus datos y las sucursales donde participás.',
    },
    loadComponent: () => import('./pages/perfil/perfil').then((module) => module.Perfil),
  },
  {
    path: 'solicitudes/todas',
    canActivate: [authGuard],
    title: 'AppointMee | Historial de solicitudes',
    data: {
      title: 'Historial de solicitudes',
      description: 'Consultá el historial completo de tus solicitudes para ser empleador.',
    },
    loadComponent: () =>
      import('./pages/solicitudes-historial/solicitudes-historial').then(
        (module) => module.SolicitudesHistorial,
      ),
  },
  {
    path: 'solicitudes/empleo/recibidas',
    canActivate: [authGuard],
    title: 'AppointMee | Historial de solicitudes de empleo',
    data: {
      title: 'Historial de solicitudes de empleo',
      description: 'Consultá todas las invitaciones de empleo que recibiste.',
    },
    loadComponent: () =>
      import(
        './pages/solicitudes-empleado-historial/solicitudes-empleado-historial'
      ).then((module) => module.SolicitudesEmpleadoHistorial),
  },
  {
    path: 'solicitudes',
    canActivate: [authGuard],
    title: 'AppointMee | Solicitudes',
    data: {
      title: 'Solicitudes',
      description: 'Seguí el estado de tus solicitudes y enterate de las novedades.',
    },
    loadComponent: () =>
      import('./pages/solicitudes/solicitudes').then((module) => module.Solicitudes),
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
    loadComponent: () => import('./pages/admin/admin').then((module) => module.Administracion),
  },
  {
    path: 'design-system',
    title: 'AppointMee | Sistema de diseño',
    loadComponent: () => import('./pages/design-system/design-system').then((m) => m.DesignSystemPage),
  },
  {
    path: '**',
    title: 'AppointMee | Página no encontrada',
    loadComponent: () =>
      import('./pages/no-encontrada/no-encontrada').then((module) => module.NotFoundPage),
  },
];
