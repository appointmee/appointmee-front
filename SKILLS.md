# SKILLS.md — AppointMee Front

Guía operativa para agentes de IA que trabajan en **AppointMee Front**.
Complementa [`AGENTS.md`](AGENTS.md). Si hay conflicto, **manda `AGENTS.md`** y se pregunta
antes de asumir.

> Última revisión: 2026-11-24, sobre `origin/develop` (`2c6bbea`).

---

## 0. Regla de oro

Antes de tocar código:

1. `git status --short` + `git branch --show-current` + `git log --oneline -5`.
2. Si hay cambios ajenos sin commitear, **no mezclarlos**: usar un `git worktree` aparte o
   preguntar.
3. Nunca trabajar sobre `main` ni `develop`.
4. Crear la rama desde `origin/develop` **antes** de editar.
5. Identificar la historia de Jira (`SCRUM-<id>`). Si no existe, pedirla o proponer el
   nombre de rama; **no inventar IDs**.
6. **Antes de cada `git push`, hacer pull obligatorio con rebase** (ver §3).

---

## 1. Contexto real del repositorio

| Ítem | Valor |
|---|---|
| Framework | Angular **22.1** standalone, sin SSR, `loadComponent` en todas las rutas |
| Lenguaje | TypeScript **6.0** |
| Estado | Angular Signals + servicios; no hay store externo |
| Tests | **Vitest + jsdom** vía `@angular/build:unit-test` (60 specs unitarios al 2026-11-24) |
| E2E | **Playwright** (`e2e/critical-flows.spec.ts`, `e2e/design-system.spec.ts`) |
| UI | Español, tema oscuro, tokens en `src/styles.css`, foco en accesibilidad |
| Backend | `http://localhost:8080` en local; URL centralizada en `src/app/services/backend-service.ts` |
| Deploy | Vercel: rewrite SPA + CSP/cabeceras en `vercel.json` |
| Calidad | Presupuestos de build: 500 kB warning / 1 MB error inicial; 24/32 kB por componente |

### Mapa del código

```text
src/app/
├── pages/            # ~40 vistas: home, sucursales, detalle, servicios, reserva,
│                     # pago, mis-turnos, mis-sucursales, admin, gráficos,
│                     # configuración, auth, errores, design-system
├── components/       # Modales y piezas de dominio reutilizables
├── services/         # HTTP + estado (auth, sucursal, servicio, turno, pago,
│                     # solicitudes, reseñas, verificación, estadísticas)
├── models/           # DTOs TypeScript
├── guards/           # authGuard, guestGuard, verificationGuard
├── interceptors/     # authInterceptor (Bearer + refresh)
├── http/             # errores globales/inline y contexto SIN_MANEJO_GLOBAL_DE_ERRORES
├── security/         # validación de tokens de reset
├── shared/           # utilidades + shared/ui (ds-button, ds-card, ds-input, misc)
└── e2e/              # flujos críticos y sistema de diseño
```

Rutas destacadas: `/`, `/sucursales`, `/sucursal/:id`, `/sucursal/:id/servicios`,
`/sucursal/:sucursalId/servicios/:servicioId/empleados`,
`/sucursal/:sucursalId/servicios/:servicioId/turnos`, `/pago/resultado`,
`/mis-turnos`, `/mis-sucursales/*`, `/turnos-asignados`, `/perfil`, `/solicitudes/*`,
`/configuracion`, `/admin`, `/graficos/*`, `/design-system`, `/login`, `/registrarme`,
`/olvide-mi-contrasena`, `/reset-password`, `/error`, `/**`.

> `docs/arquitectura.md` está desactualizado: describe como genéricas varias pantallas
> que ya están implementadas. Para rutas, la fuente de verdad es `src/app/app.routes.ts`.

---

## 2. Jira: proyecto `SCRUM`

Sitio: `appointmee.atlassian.net` · Proyecto: **SCRUM** · Board: **SCRUM**.

### 2.1 Tipos y estados

| Tipos de issue | Estados |
|---|---|
| `Epic`, `Story`, `Task`, `Fix`, `Subtask` | `Por hacer` → `En curso` → `En revisión` → `Finalizado` |

### 2.2 Formato de las historias

Las historias siguen una plantilla estable:

```text
US-<ÁREA>-<NN> · <Módulo> · <Nuevo|Mejora|Fix> · Rol: <Cliente|Empleado|Empleador|Administrador>

### Historia
Como <rol>, quiero <objetivo> para <beneficio>.

### Objetivo / demo
* Demo 1: ...
* Demo 2: ...

### Criterios de aceptación
* ...

### Dependencias
* ...
```

Al implementar, **cada criterio de aceptación debe poder demostrarse** y, cuando aplique,
tener test.

### 2.3 Trazabilidad Jira ↔ Git

- Rama: `SCRUM-<id>-<slug-kebab>` (ej. `SCRUM-306-arreglar-vista-fotos-equipo`).
- Commit: referenciar `SCRUM-<id>` en el asunto o en el cuerpo cuando aporte.
- PR: título `tipo(scope): resumen`; body con qué cambió, cómo se probó, criterios y riesgos.
- Al mergear el PR a `develop`, mover el issue a `Finalizado`.
- `develop` → `main` se hace por PR de release, no push directo.

### 2.4 Contexto de sprint

Al cierre de esta revisión el sprint activo es **SCRUM Sprint 4** (24/11 → 08/12), con foco
en pasarela de pagos propia, mapa/búsqueda por cercanía, notificaciones in-app y chat.
Verificar el sprint real antes de planificar.

---

## 3. Git: flujo obligatorio

```bash
git fetch origin develop
git switch -c SCRUM-<id>-<slug> origin/develop
# ... implementar ...
git fetch origin develop
git pull --rebase origin develop   # OBLIGATORIO antes de pushear
git push -u origin HEAD
gh pr create --base develop --head SCRUM-<id>-<slug> \
  --title "tipo(scope): resumen" --body-file /tmp/pr-body.md
gh pr view <n> --json number,title,baseRefName,headRefName,state,url,commits
```

### Pull obligatorio antes de pushear

**Nunca pushear sin sincronizar antes con `develop`.** Repetir el pull justo antes de **cada**
push, no solo al crear la rama ni al abrir el PR:

```bash
git fetch origin develop
git pull --rebase origin develop
```

- Si hay conflictos, resolverlos y volver a correr tests/build antes de pushear.
- Si la rama ya estaba publicada y el rebase reescribió historia, actualizarla con
  `git push --force-with-lease` **solo en tu rama de historia**; nunca sobre `develop`/`main`.
- Esto evita pushes rechazados, merges innecesarios y PRs con commits de otros.

Reglas:

- Base del PR: **`develop`**. Nunca `main`.
- No force-push sobre ramas compartidas sin pedido explícito.
- No commitear `.env`, `node_modules`, `dist`, `coverage`, `.angular` ni secretos.
- Un commit = una funcionalidad coherente. Separar implementación y tests si el cambio es grande.
- Para documentación con working tree sucio: `git worktree add` y rama `docs/<slug>`.
- `main` solo recibe releases desde `develop`.

### Convención de commits

`Conventional Commits` en español:

```text
feat(reserva): elegir profesional y horario
fix(perfil): mantener proporción de la foto
test(servicios): cubrir error inline y reintento
docs: documentar contratos de reserva
refactor(busqueda): centralizar filtros
chore(ci): configurar cobertura mínima
```

---

## 4. Skills (procedimientos reutilizables)

### 4.1 Tomar una historia de Jira

1. Leer issue: historia, objetivo/demo, criterios y dependencias.
2. Traducir criterios a una lista de verificación.
3. Crear rama `SCRUM-<id>-<slug>` desde `origin/develop`.
4. Identificar pantallas/servicios/modelos afectados en el mapa del código.
5. Implementar + tests por criterio.
6. Pasar test puntual, suite completa y build.
7. Commit(s) + PR a `develop` + mover issue a `En revisión`.

### 4.2 Implementar una pantalla o flujo

Checklist mínimo:

- [ ] Componente standalone + `ChangeDetectionStrategy.OnPush`.
- [ ] `inject()` para dependencias; `signal()`/`computed()` para estado local.
- [ ] `takeUntilDestroyed()` en subscripciones de larga vida.
- [ ] Estados: **skeleton**, **vacío con acción**, **error inline**, **sin conexión**,
      **reintento** y **placeholder de imagen** cuando aplique.
- [ ] Reintento conserva contexto (sucursal, filtros, búsqueda), se deshabilita con
      `aria-busy` y bloquea doble clic con un guard del componente.
- [ ] Anuncios con `role="alert"`/`role="status"` + `aria-live`.
- [ ] Textos y nombres accesibles en español.
- [ ] Sin `alert()` ni redirección a `/error` para errores recuperables.
- [ ] Respetar `prefers-reduced-motion`.
- [ ] Precios con `Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })`.

### 4.3 Lecturas con manejo inline

Usar el contexto `SIN_MANEJO_GLOBAL_DE_ERRORES` para que el interceptor no redirija y el
componente muestre su propio estado de error/reintento. Es el patrón de listados y detalles.

### 4.4 Formularios (US-ERR-05)

- Error debajo del campo; resumen arriba con enlaces cuando hay varios.
- Foco al primer campo inválido al enviar.
- `aria-invalid="true"` + `aria-describedby` al mensaje.
- El error se limpia al corregir el campo.
- Conservar valores ingresados (salvo contraseñas cuando corresponda).
- Mapear errores de backend por campo; error general en banner inline.
- Validar en cliente **y** asumir validación de servidor.

### 4.5 Sistema de diseño (US-GEN-01)

- Tokens en `:root` de `src/styles.css`: no hardcodear color/tamaño/sombra si existe token.
- Componentes `ds-*` en `src/app/shared/ui/` (`ds-button`, `ds-card`, `ds-input`, `misc`).
- Textos visibles configurables por pantalla (`@Input`, `ng-content` o equivalente).
- Accesibilidad: labels, foco visible, semántica/roles, Escape en diálogos, teclado completo.
- Contraste WCAG AA; documentar en `docs/design-system.md`.
- Todo componente nuevo suma demo en `/design-system` y tests de estados/teclado.
- Al tocar una pantalla, migrar sus controles al sistema.

### 4.6 Tests unitarios (Vitest)

Comandos:

```bash
# Un spec
npx ng test --watch=false --include='src/app/pages/servicios/servicios.spec.ts'

# Suite completa (obligatoria antes de PR)
npx ng test --watch=false

# Build (obligatorio antes de PR)
npx ng build

# Cobertura (si está instalado @vitest/coverage-v8)
npx ng test --watch=false --coverage --coverage-reporters=text-summary
```

Reglas:

- Cubrir criterios de aceptación y caminos de error/edge, no solo happy path.
- Casos típicos: carga, vacío, error inline, offline, reintento, doble clic, accesibilidad,
  fallback de imágenes y restauración de estado.
- Sin `alert()`, sin `.only`, sin `.skip` injustificados, sin `setTimeout` reales evitables.
- Restaurar mocks, timers, spies y propiedades globales (`navigator.onLine`, etc.).
- La suite debe quedar **> 60 tests** (AGENTS.md) y no reducirse.

### 4.7 E2E (Playwright)

```bash
npm run e2e:install   # una vez
npm run e2e
```

- `e2e/critical-flows.spec.ts` cubre login, registro/verificación, recuperación de
  contraseña, ajustes, búsqueda, detalle y selección de servicio.
- `e2e/design-system.spec.ts` valida la demo del sistema de diseño.
- Hay un guard de **fuga de datos sensibles**: no imprimir tokens/OTP/passwords en consola,
  URLs, analytics ni terceros.
- Los flujos críticos deben terminar sin errores de consola.

### 4.8 Documentación

- Actualizar `docs/` cuando cambie arquitectura, contratos, rutas o infraestructura.
- `docs/arquitectura.md` requiere revisión: está desfasado respecto de `app.routes.ts`.
- Documentar decisiones y limitaciones en `docs/pendientes.md`.
- Rama `docs/<slug>`, commit `docs: ...`, PR a `develop`.

### 4.9 Cierre y PR

1. `git diff` y `git status` sin archivos ajenos.
2. `npx ng test --watch=false` en verde.
3. `npx ng build` en verde.
4. Pull obligatorio con rebase sobre `origin/develop` (`git pull --rebase origin develop`).
5. Push + PR a `develop` con: qué cambió, cómo se probó, capturas si aplica, riesgos.
6. Verificar PR (`baseRefName=develop`) y dejar issue en `En revisión`.

---

## 5. Seguridad y calidad (US-GEN-04)

- Escapar todo dato dinámico; **prohibido `innerHTML` con datos de usuario** sin sanitizar.
- No guardar tokens, contraseñas ni OTP en URL, logs o analytics.
- Validar `returnTo` contra una lista de rutas internas antes de redirigir.
- No secretos en el frontend; la CSP y cabeceras viven en `vercel.json`.
- Errores de red con mensajes seguros, sin detalles internos.
- Revisar imágenes externas: privacidad y rendimiento.
- Mantener dependencias sin vulnerabilidades críticas conocidas.

> Nota: los tokens se guardan en `localStorage` (`token`, `refreshToken`). Es una decisión
> documentada; evaluar cookies `HttpOnly`/`Secure`/`SameSite` es un pendiente de arquitectura.

---

## 6. Definition of Done

- [ ] Rama desde `origin/develop`, sin historias ajenas.
- [ ] Criterios de aceptación cumplidos y demostrables.
- [ ] Tests nuevos para comportamiento, error y edge cases.
- [ ] Suite completa > 60 tests y en verde.
- [ ] `npx ng build` en verde.
- [ ] Commits separados por funcionalidad, en español.
- [ ] PR contra `develop` con qué cambió, cómo se probó y riesgos.
- [ ] Working tree limpio o pendientes informados.
- [ ] Issue de Jira actualizado.

---

## 7. Trampas conocidas

| Tema | Detalle |
|---|---|
| Suite baseline | En `develop`, `sucursal-detalle.spec.ts` puede fallar por requests de reseñas/equipo no mockeadas. Reproducir en worktree limpio antes de atribuirlo a un cambio nuevo. |
| Docs desfasadas | `docs/arquitectura.md` no refleja todas las rutas actuales. Usar `app.routes.ts`. |
| `package.json` local | Puede aparecer un bloque `allowScripts` sin commitear por el entorno. No mezclarlo con una historia. |
| Rutas de reserva | El flujo real es servicio → empleado → turno → pago; no asumir rutas viejas de la documentación. |
| Tests E2E | Dependen del backend/URL configurada; revisar `playwright.config.ts` y `e2e/` antes de correrlos. |
| Presupuesto de build | Un componente con CSS > 24 kB dispara warning y > 32 kB rompe el build. |
| `main` vs `develop` | `main` es producción; no se toca directamente. |
