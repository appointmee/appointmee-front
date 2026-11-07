# Seguridad y calidad del frontend (US-GEN-04)

## DOM y datos dinámicos

- Las vistas insertan datos dinámicos mediante interpolaciones y bindings de Angular, con su escapado contextual por defecto.
- El código de producción no usa `innerHTML`, `insertAdjacentHTML`, `document.write` ni `bypassSecurityTrust*`.
- `returnTo` se analiza con Angular Router, debe ser relativo, no puede ser protocol-relative, contener barras invertidas/control characters, apuntar a login ni tener una raíz ausente de la configuración de rutas.

## CSP y cabeceras

- `src/index.html` contiene una CSP de respaldo para desarrollo; sus scripts deben ser externos y del mismo origen.
- `vercel.json` entrega CSP por cabecera, `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` y una `Permissions-Policy` restrictiva.
- La política limita imágenes al origen del frontend, `data:` y la API HTTPS conocida. Las imágenes de terceros quedan bloqueadas y las vistas ya muestran placeholders ante ese fallo.
- Analytics solo se carga fuera de localhost desde un script del mismo origen. El callback quita query y fragmentos de cada URL antes de enviar el evento.

## Credenciales, tokens y logs

- Contraseñas y códigos OTP permanecen en memoria durante el formulario y se envían en el cuerpo POST; no se escriben en logs ni analytics.
- Los tokens de sesión se mantienen en `localStorage`; el ticket limitado de verificación usa `sessionStorage`. Ninguno se escribe en logs o analytics.
- Los enlaces de recuperación deben usar `#token=...`: el fragmento no se transmite en la petición HTTP inicial. `main.ts` captura el token y reemplaza la entrada del historial antes de iniciar Angular; el token queda solo en memoria y se consume una vez.
- Por compatibilidad temporal, el frontend también acepta enlaces antiguos con `?token=...` y limpia el historial en el bootstrap. La petición HTTP inicial de un enlace query ya pudo quedar registrada por el hosting. Para cerrar esa brecha, el backend debe dejar de generar enlaces query y usar el fragmento o, preferentemente, un intercambio de enlace por cookie segura HttpOnly.
- La vista de error registra solo pantalla, referencia y status. El error de bootstrap no imprime el objeto/stack crudo.
- `apiErrorsService` expone mensajes genéricos y errores de campo normalizados, nunca el cuerpo crudo del backend.

## Validación y backend

- Login, registro, recuperación, reset y verificación validan en cliente antes de enviar.
- La validación del servidor no se puede certificar desde este checkout: el backend no está incluido. Los E2E de este repositorio simulan respuestas HTTP y no sustituyen pruebas o revisión del servidor.
- La API local es `http://localhost:8080`; fuera de localhost se usa `https://appointmee-vcs2.onrender.com`. Ambos orígenes de despliegue deben mantener validación, rate limits y CORS correctos.

## Imágenes

- Las imágenes remotas permitidas provienen de la API conocida; la política bloquea hosts arbitrarios para evitar tracking de terceros.
- Las tarjetas usan carga diferida y decodificación asíncrona; las vistas principales aplican fallback local. Se envía `no-referrer`.
- Si el backend usa una CDN distinta para fotos, debe revisarse y agregarse el host exacto a CSP antes de permitirlo. Evitar `https:` como comodín.

## Dependencias y pruebas

- `npm audit` se ejecutó el 2026-11-07 sobre 431 dependencias: 0 vulnerabilidades conocidas.
- `npm test -- --watch=false` ejecuta Vitest/jsdom.
- `npm run e2e` ejecuta Playwright/Chromium y recorre login, registro + verificación, recuperación, búsqueda, detalle y elección de servicio/horario. Los endpoints se simulan; el test falla ante requests de API no previstas y errores JavaScript/de consola. En registro/verificación tolera solamente el mensaje de red que Chromium emite por el 403 esperado de cuenta pendiente.
- `npm run build` valida el build de producción.
- Angular CLI 22 requiere Node 22.22.3 o superior; `.nvmrc` selecciona Node 22.23.4 para desarrollo y CI.

## Operación

- Ejecutar tests, E2E, build y `npm audit` en CI al cambiar dependencias o flujos críticos.
- El frontend no puede demostrar la validación del servidor ni corregir el formato de los enlaces que envía el backend. Esas dos comprobaciones quedan como contrato de integración backend.
- Para que tampoco aparezca el 403 esperado como error de recurso en DevTools, el backend tendría que expresar “verificación pendiente” con una respuesta 2xx tipada. La UI ya trata este estado; el cambio de código HTTP está fuera de este repositorio.
