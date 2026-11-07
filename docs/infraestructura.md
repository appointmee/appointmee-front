# Infraestructura y operación

## Lo comprobable en este checkout

| Área | Configuración encontrada | Implicación para frontend |
|---|---|---|
| Build | Angular CLI 22, builder `@angular/build:application` | Salida estática SPA |
| Runtime local | `npm start` ejecuta `ng serve --host localhost --port 4200` | Desarrollo local en `http://localhost:4200` |
| API | `http://localhost:8080` en local; `https://appointmee-vcs2.onrender.com` en otros hosts | Requiere CORS habilitado para el host del frontend |
| Hosting | `vercel.json` reescribe cualquier ruta a `/index.html` | Habilita deep links de Angular Router |
| Assets | `public/` se copia al build; fuentes Geist y logo | Assets estáticos del cliente |
| CI/CD, backend, datos | No hay workflows, Dockerfile, compose, Terraform, Helm, manifiestos de cloud ni migraciones en este checkout | Topología, escalado, secretos y persistencia no pueden documentarse aquí |

## Despliegue frontend

La configuración visible sugiere hosting estático en Vercel con rewrite SPA. No define proyecto, comandos de instalación/build/output en Vercel, variables de entorno, dominios, previews ni promoción entre ambientes. El `vercel.json` no crea un proxy a API.

Para despliegues reales, separar configuración por entorno (desarrollo, staging, producción), exponer una base URL HTTPS mediante configuración de build/runtime y rechazar explícitamente valores no seguros en producción. La URL del API no debe depender de una constante local. Alinear CORS del backend con los dominios y previews permitidos.

## Topología lógica esperada

```text
Navegador
  ├── archivos estáticos SPA (hosting; Vercel rewrite observado)
  └── HTTPS JSON ──> API backend (origen, infraestructura y dependencias no presentes)
```

No inferir base de datos, colas, proveedor de correo, almacenamiento de fotos, proveedor de identidad, balanceadores ni servicios cloud: el frontend solo expone indicios de email, tokens e imágenes en DTOs.

## Lista necesaria para completar infraestructura

- Inventario del backend y diagrama de despliegue (servicios, redes, ingress, puertos y dependencias).
- Ambientes, dominios, DNS, TLS/renovación de certificados, CORS y política CSP.
- Provisionamiento como código y configuración reproducible; Docker/compose para desarrollo si aplica.
- CI/CD: build, lint/verificación, pruebas, artefactos, previews y reglas de promoción/rollback.
- Configuración de frontend por ambiente, sin secretos en bundle; gestión de secretos de backend.
- Logs estructurados, métricas, trazas, alertas, IDs de correlación y políticas de retención.
- Backups/restauración y recuperación ante desastres para cualquier almacenamiento persistente del backend.
- Límites de tasa y protección contra abuso, especialmente login, recuperación y verificación por código.
- SLO, health/readiness checks, estrategia de mantenimiento y proceso de incidentes.
- Política de seguridad de dependencias, actualizaciones, análisis de artefactos y respuesta a vulnerabilidades.
