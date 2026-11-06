# AGENTS.md

Instrucciones obligatorias para cualquier IA o agente que trabaje en **AppointMee Front**.
Leer este archivo antes de tocar código. Si una instrucción del usuario contradice estas
reglas, preguntar antes de asumir.

## 1. Contexto del proyecto

- Aplicación web **Angular 22** standalone, sin SSR.
- UI en español, con foco en accesibilidad y estados de carga/error/offline.
- Tests con **Vitest + jsdom** mediante `@angular/build:unit-test`.
- Backend local esperado en `http://localhost:8080`.
- Build estático para Vercel con rewrite SPA.
- Documentación del proyecto en `docs/`.

Mapa rápido:

- `src/app/pages/`: vistas (home, sucursales, detalle, servicios, login, configuración, error, 404).
- `src/app/services/`: acceso HTTP y estado de autenticación.
- `src/app/models/`: DTOs consumidos.
- `src/app/http/`: manejo global/inline de errores.
- `src/app/guards/`, `src/app/interceptors/`: sesión, roles y token.
- `src/app/shared/`: utilidades compartidas.
- `src/app/components/`, `src/app/navbar/`: componentes reutilizables.

Comandos habituales:

```bash
npm start                 # ng serve en localhost:4200
npm run build             # build de producción
npx ng test --watch=false # suite completa
```

## 2. Flujo obligatorio: rama primero, nunca main/develop directo

**Nunca trabajar directamente sobre `main` ni sobre `develop`.** Cada historia, fix,
documentación o refactor debe tener su propia rama y, cuando corresponda, su PR.

Antes de modificar archivos:

1. Revisar el estado real del repositorio:
   ```bash
   git status --short
   git branch --show-current
   git log --oneline -5
   ```
2. No descartar, sobrescribir ni mezclar cambios que ya estén en el working tree. Si hay
   cambios pendientes, identificar a qué funcionalidad pertenecen y commitearlos por
   separado, o preguntar al usuario.
3. Actualizar la base:
   ```bash
   git fetch origin develop
   ```
4. Crear la rama desde el último `origin/develop`:
   ```bash
   git switch -c SCRUM-<id>-<slug-kebab> origin/develop
   ```
   - Si la historia no trae ID, **pedir o proponer el nombre de rama antes de empezar**.
   - No inventar IDs de Jira/SCRUM.
   - Para documentación usar `docs/<slug>`.
   - Para fixes puntuales usar `fix/<slug>`.
   - Para funcionalidades sin ID usar `feature/US-<AREA>-<NN>-<slug>`.
5. Si la rama actual ya tiene commits de dependencias que todavía no están en `develop`,
   no mezclar historias nuevas: crear la nueva rama desde `origin/develop` y traer solo
   lo necesario.
6. Antes de abrir el PR, rebasar sobre la última `develop`:
   ```bash
   git fetch origin develop
   git rebase origin/develop
   ```
7. Pushear la rama:
   ```bash
   git push -u origin HEAD
   ```
8. Abrir el PR **siempre contra `develop`**, nunca contra `main`:
   ```bash
   gh pr create --base develop --head <branch> \
     --title "<tipo>(<scope>): <resumen>" \
     --body-file /tmp/pr-body.md
   ```
9. Verificar que base, head y commits sean correctos:
   ```bash
   gh pr view <numero> --json number,title,baseRefName,headRefName,state,url,commits
   ```

Reglas de git:

- No hacer push directo a `main` ni a `develop`.
- No hacer force-push sobre ramas compartidas sin pedido explícito.
- No reescribir historia publicada sin autorización.
- No commitear secretos, `.env`, `node_modules`, `dist`, `coverage` ni caches.
- Si `gh` no está disponible o no hay sesión, pushear la rama y entregar la URL de
  comparación para que el usuario abra el PR manualmente.
- Para tareas de documentación con cambios locales sin commitear, usar un
  `git worktree` separado o una rama limpia; no arrastrar archivos ajenos al commit.

## 3. Commits: por funcionalidad, no por archivo

Usar **Conventional Commits** en español, con scope cuando aporte claridad:

```text
feat(servicios): mejorar estados de carga, error y sin conexión
fix(reserva): evitar anuncio duplicado del aviso de rol
test(servicios): cubrir estados y reintentos de US-SERV-06
docs: agregar documentación general del frontend
chore(ci): configurar cobertura mínima
refactor(busqueda): centralizar reglas de filtros
```

Reglas:

- Un commit = una funcionalidad o corrección coherente.
- Separar implementación y tests en commits distintos cuando el cambio sea grande.
- No mezclar una historia con un fix no relacionado.
- Mensajes claros, en español, sin descripciones vacías.
- Antes de commitear, revisar `git diff` y `git status` para no incluir archivos ajenos.

Ejemplo del flujo usado en este proyecto:

```text
feat(búsqueda): mejorar búsqueda de sucursales y sus estados
feat(servicios): mejorar estados de carga, error y sin conexión
test(servicios): cubrir estados y reintentos de US-SERV-06
```

## 4. Tests: obligatorios, más de 60 y sin romper la suite

La suite completa debe mantenerse **por encima de 60 tests** (al 2026-11-06 tiene 110).
Un PR no debe reducir ese número. Cada comportamiento nuevo debe sumar tests.

Reglas:

- Testear los criterios de aceptación, no solo el camino feliz.
- Cubrir, según la historia: carga, vacío, error inline, offline, reintento, doble clic,
  accesibilidad y fallback de imágenes.
- No usar `alert()` en la aplicación ni en tests.
- No dejar tests con `.only`, `.skip` injustificados ni `setTimeout` reales si se pueden
  evitar.
- Restaurar mocks, timers, spies y propiedades modificadas (`navigator.onLine`, etc.).
- Un test que falla no se “arregla” ocultándolo: se corrige el código o el test.
- Si la suite ya viene roja desde `develop`, reproducir la falla en un worktree limpio
  sobre `origin/develop` y reportarlo por separado. No mezclar el baseline roto con el PR.
- Cobertura objetivo: **>= 60 %** cuando se mida cobertura. Si la herramienta no está
  configurada, indicarlo en el PR y no afirmar una cobertura que no se midió.

Comandos:

```bash
# Test puntual durante desarrollo
npx ng test --watch=false --include='src/app/pages/servicios/servicios.spec.ts'

# Suite completa antes de commitear/PR
npx ng test --watch=false

# Build obligatorio antes del PR
npx ng build

# Cobertura (requiere @vitest/coverage-v8 instalado)
npx ng test --watch=false --coverage --coverage-reporters=text-summary
```

Estado conocido: en `develop` la suite completa puede fallar en
`sucursal-detalle.spec.ts` por requests de reseñas/equipo que el spec no mockea.
Verificar siempre contra `origin/develop` antes de atribuir esa falla a un cambio nuevo.

## 5. Convenciones Angular y de producto

- Componentes **standalone**, `ChangeDetectionStrategy.OnPush`.
- Preferir `inject()`, `signal()`, `computed()` y `takeUntilDestroyed()`.
- Mantener el estilo existente de templates, CSS y nombres en español.
- Los errores recuperables se muestran **inline**, no con `alert()` ni redirigiendo a
  `/error`.
- Para lecturas con manejo inline, usar el contexto `SIN_MANEJO_GLOBAL_DE_ERRORES`.
- Toda acción de reintento debe:
  - conservar el contexto (sucursal, filtros, búsqueda);
  - deshabilitarse y usar `aria-busy` mientras carga;
  - bloquear dobles clics con un guard en el componente;
  - anunciar el estado con `role="alert"`/`role="status"` y `aria-live`.
- Estados visuales obligatorios cuando aplique: skeleton, vacío con acción, error inline,
  sin conexión, placeholder de imagen y reintento.
- Respetar `prefers-reduced-motion`.
- No romper accesibilidad: labels, foco visible, nombres accesibles y navegación por teclado.
- Los precios se formatean con `Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })`.
- No agregar dependencias sin necesidad; si se agrega, actualizar `package-lock.json`.

## 6. Metodología usada en esta sesión (replicar)

Así se trabajó en `SCRUM-234-estados-de-carga-vacio-y-error-al-elegir-servicio`:

1. Inspeccionar `git status`, ramas y últimos commits antes de tocar nada.
2. Detectar cambios pendientes y commitearlos por funcionalidad en la rama nueva.
3. Implementar la historia completa (skeleton, vacío, error inline, offline, placeholder,
   aria-live y bloqueo de reintentos).
4. Agregar tests específicos de los criterios de aceptación.
5. Correr tests puntuales, suite completa y build.
6. Commitear implementación y tests por separado.
7. Rebasear sobre el último `origin/develop`.
8. Pushear y abrir PR con base `develop`.
9. Verificar el PR y reportar rama, commits, tests y riesgos conocidos.

Para documentación:

1. Actualizar la rama documental con `git fetch` + fast-forward.
2. Si el working tree tiene cambios, usar un worktree aparte.
3. Commitear los documentos con `docs: ...`.
4. Pushear y, si corresponde, abrir PR contra `develop`.

## 7. Definición de terminado

Una tarea está terminada solo cuando:

- La rama existe, sale de `origin/develop` y no mezcla historias ajenas.
- La funcionalidad cumple todos los criterios de aceptación.
- Hay tests nuevos para el comportamiento y los casos de error/edge relevantes.
- La suite completa tiene **más de 60 tests** y pasa (o se documentó una falla
  preexistente de `develop` con evidencia).
- `npx ng build` pasa.
- Los commits están separados por funcionalidad.
- El PR apunta a `develop` y su descripción incluye qué cambió, cómo se probó y riesgos.
- El working tree queda limpio o se informa exactamente qué quedó pendiente y por qué.
