# 8. Integraciones externas

## Mercado Pago

El README backend declara el SDK Java de Mercado Pago y recepción de webhooks. La configuración identificada es `MP_ACCESS_TOKEN`; el valor se debe aportar mediante un gestor de secretos o variable local protegida, nunca en el repositorio.

El flujo exacto de creación de preferencia, confirmación de pago, validación de firma del webhook, reintentos e idempotencia debe confirmarse en el código del backend y su Swagger. El frontend de este checkout no contiene una llamada a rutas `/pagos`; por tanto, no se documenta aquí un flujo de pago extremo a extremo como completado.

## Imágenes y Cloudinary

La interfaz consume URLs de imágenes (`fotoPerfil`, `urlFotoPerfil`, `imagenes`) desde DTO. No se encontró evidencia verificable de Cloudinary en el checkout frontend ni en el README backend revisado. Proveedor, credenciales y operaciones de subida/eliminación quedan pendientes de confirmar en la configuración y código backend.

## WhatsApp

No se identificó una llamada, variable de configuración o gateway de WhatsApp en los archivos revisados. No se puede confirmar que esta integración esté implementada. Si existe en otro servicio, documentar su URL, autenticación, plantillas, límites y manejo de errores desde su fuente operativa sin publicar tokens.

## Email de verificación y recuperación

El frontend llama a endpoints de verificación y recuperación de cuenta. El proveedor de correo, SMTP/gateway utilizado, variables requeridas y política de entrega no se identificaron en las fuentes consultadas; confirmar esos detalles con backend antes de incorporarlos.

## Errores y dependencias

Sin acceso a credenciales válidas, webhooks públicos o entornos de terceros no se verificó conectividad real con los proveedores. Para pruebas se deben usar credenciales de sandbox y endpoints controlados; no reutilizar secretos productivos.
