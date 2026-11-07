# Pendientes, huecos y acuerdos necesarios

Este documento separa faltantes visibles en el frontend de información que no está en el checkout. Una ausencia aquí no demuestra que el backend carezca de la funcionalidad.

## Faltantes funcionales visibles

- Registro: `/registrarme` renderiza una sección genérica; no hay formulario ni llamada de alta implementada. El interceptor, sin embargo, marca `/auth/register` y `/usuarios/crear` como públicos.
- Reset de contraseña: se implementa solicitud (`POST /auth/forgot-password`), pero el cliente no usa `/auth/reset-password` ni muestra una ruta para consumir un token de restablecimiento.
- Turnos: existe ruta `/mis-turnos` y texto de producto, pero se carga el componente genérico `Section`; no se encontraron contratos HTTP de disponibilidad, creación, listado, cancelación o reprogramación.
- Administración, perfil, solicitudes y sucursales propias también apuntan actualmente a contenido genérico; no documentar sus APIs como implementadas.
- La ruta de servicios exige sesión en el frontend aunque el endpoint es GET; confirmar si es una regla de negocio o solo decisión temporal de UX.
- Verificar si hay API versioning/prefijo real y resolver el endpoint de login duplicado legado (`/usuarios/inicio-sesion`) frente a `/auth/login`.

## Información externa necesaria

1. Acceso o referencia al repositorio/backend correcto para inspeccionar controladores, DTOs, seguridad y configuración.
2. OpenAPI/Swagger versionado y ejemplos reales de requests/responses/errores para los endpoints de esta guía.
3. Inventario de runtime, base de datos, correo, imágenes, redes, ambientes, secretos y despliegue del servidor.
4. Orígenes frontend por ambiente, CORS, TLS, CSP, políticas de cookies/tokens y límites de tasa.
5. Decisiones de producto sobre registro, reset, reserva y gestión de citas.

## Artefactos recomendados para completar

- `openapi.yaml` generado/verificado contra el backend y validado en CI.
- Diagrama C4 (contexto y contenedores) y diagrama de secuencia para login/refresh/verificación/reserva.
- `docs/runbooks/` para despliegue, rollback, fallos de proveedor de correo y expiración/rotación de credenciales.
- Ejemplos de entorno (`.env.example` sin secretos) y una matriz URL frontend ↔ API ↔ CORS.
- Contratos de error estables con código, campos, timestamp e ID de correlación.

## Prioridad propuesta

1. Obtener backend/OpenAPI y reconciliar discrepancias de endpoints/tipos.
2. Definir base URL por entorno y confirmar CORS/TLS de staging/producción.
3. Completar flujos comprometidos de producto (registro, reset, turnos) o marcar formalmente las rutas como roadmap.
4. Añadir diagramas y runbooks a partir de la infraestructura real.
