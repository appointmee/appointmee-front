# 6. API REST

## Fuente contractual

El frontend apunta a `http://localhost:8080`. El backend incluye Springdoc OpenAPI; con el servidor iniciado, la especificación viva está en [`/v3/api-docs`](http://localhost:8080/v3/api-docs) y la UI en [`/swagger-ui/index.html`](http://localhost:8080/swagger-ui/index.html).

La tabla siguiente registra únicamente llamadas encontradas en `src/app/services/` y `src/app/pages/`. Los verbos/rutas describen el cliente actual. Los tipos de respuesta provienen de sus modelos TypeScript y no reemplazan el contrato OpenAPI. Permisos, validaciones y códigos de error deben confirmarse en Swagger y en los controladores del backend.

## Llamadas observadas

| Método | Ruta | Uso |
| --- | --- | --- |
| `POST` | `/auth/login` | Iniciar sesión; cuerpo esperado por cliente `{ email, pass }` |
| `POST` | `/auth/logout` | Cerrar sesión |
| `POST` | `/auth/refresh` | Renovar tokens; cuerpo `{ refreshToken }` |
| `POST` | `/auth/forgot-password` | Solicitar recuperación; cuerpo `{ email }` |
| `POST` | `/auth/verification-status` | Consultar estado de verificación |
| `POST` | `/auth/send-verification` | Enviar/reintentar código |
| `POST` | `/auth/verify-email` | Validar código de email |
| `POST` | `/auth/complete-verification` | Completar sesión verificada |
| `GET` | `/usuarios/me` | Obtener perfil de sesión |
| `DELETE` | `/usuarios/borrar-cuenta` | Eliminar la cuenta propia; exige dos confirmaciones en la UI |
| `GET` | `/sucursales/listar` | Listar sucursales |
| `GET` | `/sucursales/listar/filtrar` | Filtrar por `categoria` y/o `nombre` |
| `GET` | `/sucursales/categorias` | Listar categorías |
| `GET` | `/sucursales/{idSucursal}` | Obtener detalle |
| `POST`, `PUT`, `DELETE` | `/sucursales`, `/sucursales/{idSucursal}` | Crear, actualizar y eliminar sucursal |
| `GET` | `/servicios/listar/sucursal/{idSucursal}` | Listar servicios por sucursal |
| `GET` | `/servicios/{servicioId}` | Obtener detalle de un servicio |
| `POST` | `/servicios/crear` | Crear servicio (empleador) |
| `PATCH` | `/servicios/modificar/{servicioId}` | Modificar servicio (empleador); solo se aplican los campos enviados |
| `DELETE` | `/servicios/eliminar/{servicioId}` | Eliminar servicio |
| `GET` | `/sucursales/{sucursalId}/elegir-empleado` | Listar profesionales de una sucursal |
| `POST`, `PUT`, `DELETE` | `/sucursales/{sucursalId}/empleados`, `.../empleados/{empleadoId}` | Operaciones de empleado |
| `DELETE` | `/sucursales/{sucursalId}/empleados/eliminar/{empleadoId}` | Quitar al empleado del equipo de la sucursal |
| `GET` | `/turnos/disponibilidad/empleado/{empleadoId}/servicio/{servicioId}` | Consultar disponibilidad |
| `POST` | `/turnos/registrar` | Registrar turno; payload `{ fechaHora, empleadoId, servicioId }` |
| `GET` | `/sucursales/{sucursalId}/resenias` | Listar reseñas |
| `GET`, `POST` | `/sucursales/{sucursalId}/resenias/{reseniaId?}` | Obtener/crear reseña |
| `PUT`, `DELETE` | `/sucursales/{sucursalId}/resenias/{reseniaId}` | Actualizar/eliminar reseña |

Las rutas de empleados y las operaciones CRUD pueden tener restricciones de seguridad específicas no reflejadas en esta tabla. El frontend no contiene un catálogo de códigos de error completo; su interceptor normaliza y presenta errores de API según la respuesta recibida.

## Autenticación desde Angular

El cliente guarda access/refresh token en `localStorage`. El interceptor agrega el access token a solicitudes dirigidas al backend, intenta renovar la sesión ante expiración y excluye URLs ajenas al backend. En el proceso de verificación usa `X-Verification-Token`. La política de seguridad definitiva es la implementada por Spring Security.

## Dominios backend

El README backend enumera controladores bajo `/usuarios`, `/sucursales`, `/servicios`, `/turnos`, `/solicitudes-empleado`, `/solicitudes-empleador` y `/pagos`. Consultá Swagger para obtener la lista completa vigente; el cliente frontend inspeccionado no consume todos esos dominios.
