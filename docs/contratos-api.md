# Contratos HTTP esperados por el frontend

## Convenciones

Base URL observada: `http://localhost:8080`, fija en `backendService.baseUrl`. Los ejemplos describen URLs absolutas al concatenar esa base. El frontend espera JSON salvo logout sin cuerpo. No hay OpenAPI en este checkout; validar nombres, códigos HTTP y tipos contra backend antes de tratar esta tabla como contrato normativo.

El interceptor envía Bearer en rutas privadas y omite las rutas que reconoce como públicas. La autenticación usa `pass` como nombre del campo de contraseña en login. No se observó prefijo `/api`.

## Endpoints invocados por código

| Método y ruta | Uso / acceso esperado | Request | Respuesta esperada por frontend |
|---|---|---|---|
| `POST /auth/login` | Público, iniciar sesión | `{ email: string, pass: string }` | `Tokens`: `accessToken?`, `token`, `refreshToken`, `expiresIn` |
| `POST /auth/refresh` | Público; el cliente lo llama automáticamente | `{ refreshToken: string }` | `Tokens` |
| `POST /auth/logout` | Sesión, revocar refresh actual | `{}` | Sin contenido (`void`) |
| `GET /usuarios/me` | Bearer, restaurar/cargar perfil | — | `{ id: number, roles: string[], fotoPerfil: string|null }` |
| `DELETE /usuarios/borrar-cuenta` | Bearer, eliminar la cuenta propia (Ajustes → Eliminar cuenta) | — | Texto plano `"Se eliminó la cuenta"` |
| `POST /auth/forgot-password` | Público | `{ email: string }` | `{ message: string }` |
| `POST /auth/verification-status` | Público con ticket opcional | `{ email?: string }`; `X-Verification-Token` | `{ verificada, enviado, enviadoAhora: boolean, retryAfterSeconds, attemptsRemaining, expiresInSeconds: number }` |
| `POST /auth/send-verification` | Público con ticket si existe | `{ email: string, reenviar: boolean }`; `X-Verification-Token` | `EstadoVerificacion` |
| `POST /auth/verify-email` | Público con ticket | `{ email: string, codigo: string }`; `X-Verification-Token` | `{ message, token, accessToken, refreshToken, expiresIn, usuario: PerfilResponse }` (el cliente exige tokens y perfil) |
| `POST /auth/complete-verification` | Público con ticket | `{ email?: string }`; `X-Verification-Token` | Respuesta de verificación con tokens y perfil |
| `GET /sucursales/listar` | Lectura pública en flujo de búsqueda | — | `SucursalMiniDTO[]` |
| `GET /sucursales/listar/filtrar` | Lectura pública | Query opcional `categoria`, `nombre` | `SucursalMiniDTO[]` |
| `GET /sucursales/categorias` | Lectura pública | — | `string[]` |
| `GET /sucursales/{id}` | Lectura pública | ID numérico | `SucursalDetalleDTO` |
| `GET /servicios/listar/sucursal/{id}` | La ruta de selección exige sesión en UI | ID numérico | `ServicioDTO[]` |
| `POST /observabilidad/error` | Público, sin credenciales; registro técnico mínimo | `{ screen: 'error', code, status, reference }` | `202 Accepted`, sin cuerpo |

`/auth/register`, `/auth/reset-password`, `/usuarios/inicio-sesion` y `/usuarios/crear` aparecen únicamente en la lista de omisión del interceptor. No se halló llamada que confirme que estos endpoints formen parte de una funcionalidad operativa; confirmar o retirar la discrepancia.

## Esquemas TypeScript consumidos

```ts
interface Tokens {
  accessToken?: string;
  token: string;
  refreshToken: string;
  expiresIn: number;
}
interface PerfilResponse { id: number; roles: readonly string[]; fotoPerfil: string | null }
interface SucursalMiniDTO {
  id: number; nombre: string; categoria: string; fotoPerfil: string | null;
  puntuacion: number | null; cantidadPuntuaciones: number; diasApertura?: readonly string[];
}
interface SucursalDetalleDTO {
  id: number; nombre: string; direccion: string | null; telefono: string | null;
  descripcion: string | null; fechaCreacion: string | null; categoria: string | null;
  horaApertura: string | null; horaCierre: string | null; diasApertura: readonly string[] | null;
  puntuacion: number | null; cantidadPuntuaciones: number | null; fotoPerfil: string | null;
}
interface ServicioDTO {
  id: number; nombre: string; descripcion: string | null; duracion: number;
  precio: number | string | null; fotoPerfil: string | null; puntuacion: number | null;
  cantidadPuntuaciones: number | null; nombreSucursal?: string | null;
  direccionSucursal?: string | null; categoriaSucursal?: string | null;
}
```

Los modelos completos están en `src/app/models/{auth,sucursal,servicio}.ts`. El precio acepta string porque `BigDecimal` puede serializarse así. El DTO de detalle está intencionalmente parcial respecto de la respuesta de servidor: solo tipa campos que el detalle consume.

## Errores y comportamiento requerido

- `400`/`422`: el frontend busca errores de campo en `body.fields` o en el objeto raíz y traduce las claves a mensajes genéricos.
- `401`: sesión rechazada/expirada; en peticiones protegidas se intenta refresh y reintento. Si sigue en 401 se limpia sesión y se deriva a login.
- `403`: falta de permiso; el flujo de verificación contempla `EMAIL_NOT_VERIFIED` con `verificationToken` y opcionalmente `verificationExpiresIn`.
- `409`: códigos reconocidos incluyen `EMAIL_ALREADY_EXISTS` y `SLOT_UNAVAILABLE`; otros se presentan como conflicto genérico.
- `429`: el frontend entiende `Retry-After` como segundos o fecha HTTP, o `retryAfterSeconds` en el cuerpo.
- `DELETE /usuarios/borrar-cuenta`: el backend responde con texto plano, por eso el cliente pide la respuesta como texto y no como JSON.
- Error de verificación puede incluir códigos `EMAIL_ALREADY_VERIFIED`, `VERIFICATION_CODE_INVALID`, `VERIFICATION_CODE_EXPIRED`, `VERIFICATION_ATTEMPTS_EXCEEDED`, `attemptsRemaining` y `retryAfterSeconds`.
- Fallos 0/500/502/503: mensajes seguros, reintento o pantalla inline según endpoint/contexto.

Formato recomendado a acordar con backend: `{ code, message, fields?, timestamp?, traceId? }`, con códigos estables y errores de validación en `fields`. El frontend no requiere actualmente un `traceId`; crea una referencia local aleatoria.

El formato común de error del frontend es `FrontendError = { code: string, message: string, status: number }`. Los mensajes son normalizados y seguros para UI; nunca se conserva el texto crudo del backend. El evento `POST /observabilidad/error` acepta únicamente `screen`, `code`, `status` y `reference`, se registra en logs estructurados y no incluye rutas, identidad, tokens ni stack trace. Los fallos del registro se descartan para no interrumpir la recuperación del usuario.

## Requisitos de compatibilidad

1. Tokens: definir si `token` y `accessToken` son alias heredados; fijar el campo canónico y unidades/semántica de `expiresIn`.
2. Refresh: definir rotación, reutilización/revocación, expiración, y si logout invalida toda la familia de refresh tokens.
3. Verificación: documentar duración del ticket, límite de intentos, cooldown, caducidad del código y semántica de `complete-verification`.
4. DTOs: fijar nulos, formatos de fecha/hora, enum/valores de días y precisión/unidad de `duracion` y `precio`.
5. CORS: permitir el origen real del frontend, `Authorization`, `Content-Type`, `X-Verification-Token` y exponer `Retry-After` si el cliente debe leerlo en navegador.
