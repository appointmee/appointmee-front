# Integración de Google Maps (US-MAP-03)

Esta historia prepara la infraestructura para usar **Google Maps JavaScript API** y **Places API (New)**. US-MAP-04 agrega sobre esa base un selector de direcciones sin mapa en el formulario de sucursal. No se agregaron mapas, marcadores ni geolocalización.

## Configuración de la API key

Los archivos versionados no contienen credenciales:

| Archivo | Uso |
| --- | --- |
| `src/environments/environment.ts` | Desarrollo por defecto (`npm start`). `apiKey` vacío. |
| `src/environments/environment.production.ts` | Producción por defecto (`npm run build`). `apiKey` vacío. |
| `src/environments/environment.local.example.ts` | Ejemplo sin secretos. Su marcador no es una clave válida. |
| `src/environments/environment.local.ts` | Archivo local con la clave real. **Ignorado por Git**. |

Para trabajar con Google Maps en local:

1. Copiar `src/environments/environment.local.example.ts` a `src/environments/environment.local.ts`.
2. Reemplazar el marcador por la API key real en ese archivo local.
3. Ejecutar `npm run start:maps` (o `npm run build:maps` para un bundle de producción).

Los comandos habituales `npm start` y `npm run build` siguen usando los archivos sin clave, por lo que la aplicación funciona igual y no descarga Google Maps.

En un despliegue, el pipeline debe generar `src/environments/environment.local.ts` desde un secreto antes de compilar con `npm run build:maps`. Nunca versionar ese archivo ni pegar la clave en `vercel.json`, `index.html`, tests, docs ni ejemplos. Verificar que sigue excluido con:

```bash
git check-ignore -v src/environments/environment.local.ts
```

> Una API key usada desde Angular es visible en el navegador. En Google Cloud debe restringirse por **sitios web (referrers HTTP)** y por **APIs** (solo Maps JavaScript API y Places API (New)). La ofuscación del bundle no reemplaza esas restricciones.

## Carga y reutilización

`src/app/services/google-maps-service.ts` es el único punto de carga:

```ts
private readonly maps = inject(googleMapsService);

const namespace = await this.maps.cargar();
```

- La carga ocurre solo cuando se llama a `cargar()`; no hay inicialización en `app.config.ts` ni en el arranque.
- El script se pide con `libraries=places`, `loading=async` y un callback único.
- Llamadas concurrentes o posteriores comparten la misma promesa: no se inyecta un segundo `<script>`.
- `estado` (`sin-configurar`, `cargando`, `listo`, `error`) y `fallo` (`sin-api-key`, `api-key-invalida`, `carga-fallida`, `google-no-disponible`, `sin-documento`) son señales de solo lectura para que futuras vistas muestren estados inline sin repetir lógica.
- Si falla la carga, se retira el script y se permite reintentar. También hay un timeout de 15 segundos para no dejar una promesa pendiente indefinidamente.
- Si ya existe `window.google.maps`, se reutiliza sin nueva descarga.
- No se realizan consultas de Places ni de prueba en esta historia.

El namespace expuesto tiene un tipado mínimo. Cuando se implemente una funcionalidad concreta de mapas, puede ampliarse allí o incorporar tipados oficiales; el loader no necesita cambiar.

## Selección de direcciones (US-MAP-04)

`src/app/services/google-places-service.ts` usa **Places (New)** apoyándose en `googleMapsService`:

- `AutocompleteSuggestion.fetchAutocompleteSuggestions()` obtiene sugerencias mientras se escribe, con un mínimo de 3 caracteres, debounce de 350 ms y `includedPrimaryTypes: ['street_address']`.
- Cada búsqueda abre un `AutocompleteSessionToken`; el mismo token se reutiliza implícitamente cuando `PlacePrediction.toPlace()` llama por primera vez a `Place.fetchFields()`.
- Los detalles se piden **solo después** de elegir una sugerencia y solo con los campos `formattedAddress` y `location`. El Place ID se toma de la predicción (o del `Place` ya hidratado).
- Se guardan juntos la dirección formateada, latitud, longitud y Google Place ID. Si falta cualquiera de los tres valores geográficos, el formulario bloquea el guardado en lugar de enviar datos parciales.
- En la modificación, si la dirección no cambia, no se envían geodatos y el backend conserva los anteriores. Si cambia, viajan los cuatro valores a la vez.
- No se construye un mapa ni un marcador y no se pide geolocalización (`Permissions-Policy` la mantiene deshabilitada).

## Política de CSP

`src/index.html` y `vercel.json` permiten los dominios necesarios para el script, fuentes, imágenes y conexiones de Google Maps. Para US-MAP-04 se agregó `https://places.googleapis.com` a `connect-src`, porque Autocomplete (New) y `fetchFields()` consultan ese origen (la guía de CSP de Google recomienda habilitar los dominios `googleapis.com` usados por la API). No se habilitaron APIs adicionales ni geolocalización. Es posible que una funcionalidad futura (por ejemplo, Street View o un servicio con otro dominio) requiera ajustar la CSP; hacerlo de forma puntual y documentada.

## Verificación realizada

- Build de producción y de la configuración `production-local` con un archivo local temporal: correcto.
- 8 pruebas unitarias nuevas del loader y 8 del servicio de Places: correctas.
- 11 pruebas del formulario y 6 del alta de sucursal con Places simulado: correctas.
- Suite completa: sin regresiones nuevas; queda la falla preexistente de `navbar.spec.ts` (`oculta Mis Turnos a administradores`), reproducida en un worktree limpio sobre `origin/develop`.
- **No se probó contra Google Cloud**: no hay API key disponible y no se hicieron solicitudes a Google. La comprobación real con credenciales, el aspecto de las sugerencias y el consumo real de la sesión quedan pendientes.
