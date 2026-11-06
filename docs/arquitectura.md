# Arquitectura del frontend

## Resumen

Aplicación web Angular 22 de una sola página, iniciada en `src/main.ts`. `app.config.ts` registra Router, HttpClient, interceptores funcionales y un inicializador que restaura la sesión antes de completar el arranque. Las páginas se cargan de forma diferida con `loadComponent`.

## Capas

- `pages/`: vistas y lógica de página (inicio, sucursales, detalle, servicios, login, configuración, error y 404).
- `services/`: acceso HTTP y estado de autenticación/verificación.
- `models/`: interfaces TypeScript de los DTO consumidos.
- `guards/`: reglas de acceso para visitantes, usuarios autenticados y verificación de email.
- `interceptors/` y `http/`: token Bearer, renovación de sesión y errores globales.
- `components/`, `navbar/`, `shared/`: elementos y funciones compartidos.

No se encontró una capa de estado global externa; el estado de sesión se mantiene con Angular Signals y el resto se resuelve en servicios/páginas.

## Rutas y acceso

| Ruta | Acceso que aplica el frontend | Función actual |
|---|---|---|
| `/` | Público | Inicio |
| `/sucursales`, `/listado-sucursales` | Público | Explorar y filtrar sucursales; la segunda redirige |
| `/sucursal/:id` | Público | Detalle de sucursal |
| `/sucursal/:sucursalId/servicios`, `/servicios` | `authGuard` | Selección de servicio; la segunda ruta admite contexto de sucursal |
| `/mis-turnos`, `/perfil`, `/solicitudes` | `authGuard` | Rutas con pantalla genérica de sección, no flujos de dominio completos |
| `/mis-sucursales` | `authGuard`, metadata `EMPLEADOR` | Pantalla genérica |
| `/admin` | `authGuard`, metadata `ADMINISTRADOR` | Pantalla genérica |
| `/configuracion` | `authGuard` | Configuración de cuenta |
| `/configuracion/verificar-email` | `verificationGuard` | Continuación de verificación |
| `/login` | `guestGuard` | Inicio de sesión |
| `/olvide-mi-contrasena` | Público | Solicitud de recuperación |
| `/registrarme` | Público | Actualmente pantalla genérica, no alta implementada |
| `/error`, `/**` | Público | Recuperación de error / 404 |

El detalle de sucursal permite navegar hacia la selección. La ruta protegida guarda el destino para volver tras el login. Los guards del cliente son solo UX: el backend debe autorizar cada operación por sí mismo.

## Sesión y seguridad en el navegador

- Login envía email y contraseña; ante respuesta válida guarda access y refresh tokens y consulta `GET /usuarios/me` para establecer perfil/roles.
- Los tokens se guardan en `localStorage` como `token` y `refreshToken`; el email también se persiste allí. La verificación pendiente vive en `sessionStorage` y contiene email, ticket, vencimientos y contadores, nunca código ni contraseña.
- `authInterceptor` añade `Authorization: Bearer …` solo a URLs del origen backend configurado. Omite rutas de autenticación públicas. Ante 401 puede renovar una sola vez de forma compartida, y reintenta las peticiones.
- Refresh usa un `HttpClient` creado con `HttpBackend` para evitar recursión de interceptores. Al cerrar sesión intenta revocar en servidor y limpia siempre el estado local.
- La lista de sucursales y servicios puede marcar errores como locales a la vista; el interceptor no debe redirigir en esos casos. Los errores generales se convierten a mensajes seguros, sin mostrar detalles arbitrarios del servidor.

Como los tokens son accesibles a JavaScript, una vulnerabilidad XSS podría exponerlos. El backend debe validar expiración, rotación/revocación y permisos. Evaluar cookies `HttpOnly`, `Secure`, `SameSite` y protección CSRF como alternativa de arquitectura; es una decisión pendiente, no una propiedad de este cliente.

## Flujo de datos principal

1. Sucursales solicita categorías y lista filtrada o completa.
2. Detalle solicita sucursal por ID.
3. Selección solicita detalle (para el contexto) y servicios de esa sucursal; requiere sesión según el router actual.
4. El resto de pantallas de turnos, administración y perfil no muestran integración de dominio completa en las rutas inspeccionadas.

## Calidad y compilación

Hay pruebas unitarias/componentes junto a páginas, guards, interceptores y un flujo de recuperación. Scripts disponibles: `npm start`, `npm run build`, `npm test`. Esta documentación no ejecutó pruebas ni build. La configuración de build declara presupuestos de 500 kB iniciales para warning y 1 MB para error; estilos por componente 24/32 kB. No se identificó suite e2e configurada.
