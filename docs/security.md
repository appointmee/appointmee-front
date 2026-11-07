# Seguridad y calidad del frontend (US-GEN-04)

## Política de seguridad (CSP)

Definida vía meta tag en `src/index.html`:

```html
<meta
  http-equiv="Content-Security-Policy"
  content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
/>
```

Endurecida: `script-src` sin `'unsafe-eval'` ni `'unsafe-inline'` (solo se mantiene `'unsafe-inline'` en `style-src`, requerido por estilos inline). Debe complementarse con cabeceras HTTP en despliegue (X-Frame-Options, X-Content-Type-Options, Referrer-Policy).

## Datos dinámicos y DOM

- No hay uso de `innerHTML`, `insertAdjacentHTML`, `document.write` ni equivalentes con datos de usuario.
- Todas las interpolaciones usan bindings de plantilla de Angular (sanitizados por defecto).

## Tokens, OTP y datos sensibles

- Tokens de acceso/refresh en `localStorage`; no en URLs, logs ni analytics.
- `src/index.html` limpia `query` y `hash` de URLs antes del envío (event `beforeSend`).
- `apiErrorsService` usa mensajes seguros por status y estructura de campos; nunca expone mensajes crudos del backend ni tokens.

## Validación

- Cliente: Signal Forms (`login`, `registro`, reset/verificación).
- Servidor: validaciones de negocio (evidencia en errores 400/409/422 + flujos de verificación).

## Errores

- Log mínimo sin mensajes crudos: `[AppointMee error view]` con screen, status, reference.

## Dependencias

- `npm audit`: 0 vulnerabilidades críticas conocidas.

## Flujos críticos con tests

- Login, registro + verificación, recuperación, búsqueda, detalle de sucursal y selección de servicio: cubiertos por specs existentes (`src/app/**/*.spec.ts`).

## Pendientes operativos

- Endurecer CSP a despliegue real y agregar cabeceras HTTP.
- Revisar imágenes externas (privacidad/rendimiento) con política de referrer.
- Verificación con navegador/lector de pantalla real para flujos E2E.
