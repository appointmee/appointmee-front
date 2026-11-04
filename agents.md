Te dejo dos AGENTS.md, uno por repo, porque tienen comandos, ramas y stack distintos. Si preferís uno solo combinado, lo unifico.
# AGENTS.md · appointmee-front

## Contexto

Frontend de AppointMee: aplicación Angular para buscar sucursales, elegir servicios y gestionar turnos.

- Repo: `appointmee/appointmee-front`
- Backend: `appointmee/appointmee-back` (local: `../AppointMee`)
- API local: `http://localhost:8080`
- App local: `http://localhost:4200`

## Stack

- Angular 22 (standalone components, signals, control flow `@if` / `@for`)
- TypeScript
- Vitest + TestBed + HttpTestingController
- CSS propio con variables y estilos por componente
- Prettier disponible; `.editorconfig` usa 2 espacios, comillas simples y newline final

## Comandos

```bash
npm install
npm start                 # ng serve en http://localhost:4200
npm run build             # build de producción
npm test -- --watch=false # suite completa, sin watch
```

Antes de commitear o pushear, como mínimo:

```bash
npm run build
npm test -- --watch=false
```

No hay CI configurado en el repo: la verificación es local.

## Flujo de ramas

- `main`: rama estable / releases.
- `develop`: rama de integración.
- Todo desarrollo sale de `origin/develop` actualizado:

```bash
git fetch origin
git switch develop
git pull --ff-only
git switch -c SCRUM-<numero>-<descripcion-en-kebab-case>
```

- Nombre de rama: `SCRUM-229-ver-los-servicios-de-la-sucursal`.
- Nunca commitear directamente sobre `main` ni `develop`.
- El PR va siempre contra `develop`.
- Antes de abrir el PR, actualizar la rama con `develop`, resolver conflictos y volver a correr build + tests.
- Push con seguimiento:

```bash
git push -u origin SCRUM-<numero>-<descripcion>
```

- No hacer `force-push` sobre una rama compartida sin pedir confirmación.
- Si el número de ticket, el nombre de rama o el alcance no están claros, preguntar antes de crear la rama.

## Commits

Formato Conventional Commits:

```text
<tipo>(<scope>): <descripcion>
```

Tipos: `feat`, `fix`, `test`, `refactor`, `style`, `docs`, `chore`.

Scopes habituales: `auth`, `errors`, `404`, `home`, `navbar`, `sucursales`, `servicios`, `configuracion`, `perfil`, `turnos`, `admin`.

Reglas:

- Descripción en español, modo imperativo/infinitivo, sin punto final, clara y corta.
- Commits atómicos por funcionalidad. No hacer un commit gigante con todo.
- Separar, cuando aporte claridad:
  - infraestructura compartida (por ejemplo, manejo de errores),
  - integración con una API,
  - pantalla / UI,
  - tests.
- Si una funcionalidad toca frontend y backend, son commits y PRs separados, coordinados y enlazados.
- Stagear rutas explícitas. Revisar siempre:

```bash
git status
git diff --staged
```

- No agregar cambios ajenos ni archivos eliminados que no formen parte de la tarea.
- No commitear `dist`, `node_modules`, `.angular/cache`, `coverage`, secretos ni `.env`.

## Código Angular

- Componentes standalone. No crear NgModules.
- Rutas con lazy loading en `src/app/app.routes.ts`.
- Estado con `signal`, `computed` y `inject()`.
- Usar `ChangeDetectionStrategy.OnPush`.
- Desuscribirse con `takeUntilDestroyed` cuando corresponda.
- Usar `@if` / `@for`; no `*ngIf` / `*ngFor`.
- Organización:
  - `src/app/pages`: pantallas.
  - `src/app/services`: servicios HTTP.
  - `src/app/models`: interfaces y DTOs.
  - `src/app/http`: manejo global de errores.
  - `src/app/interceptors`: interceptores.
  - `src/app/guards`: guards.
- Los servicios existentes usan clase en minúscula (`sucursalService`, `servicioService`). Mantener esa convención.
- Usar siempre `backendService.baseUrl`; no hardcodear `http://localhost:8080` en componentes.
- No instalar dependencias nuevas sin consultar.
- No tocar `src/app/pages/login-anterior-borrable` salvo pedido explícito.
- No duplicar interceptores ni manejadores globales de errores.

### Errores HTTP

- Por defecto, el interceptor global muestra el aviso o navega a `/error`.
- Si una pantalla necesita error inline con su propio “Reintentar”, marcar la petición con:

```ts
new HttpContext().set(SIN_MANEJO_GLOBAL_DE_ERRORES, true)
```

- En ese caso, el componente debe mostrar el error, conservar el contexto y ofrecer reintento. No duplicar el aviso global.

## UI, UX y accesibilidad

- Idioma de la interfaz: español rioplatense.
- Textos consistentes: “Elegí”, “Necesitás”, “Volver”, “Reintentar”.
- Respetar el estilo visual existente: tema oscuro, variables CSS, acento dorado, tipografía Geist.
- CSS por componente, mobile-first, con `prefers-reduced-motion` cuando haya animaciones.
- Toda pantalla debe incluir:
  - jerarquía correcta de headings,
  - foco visible,
  - navegación por teclado,
  - labels y `alt`,
  - `role="alert"` / `role="status"` / `aria-live` cuando corresponda,
  - estados de carga, vacío y error,
  - comportamiento responsive,
  - fallback de imágenes.
- Si la historia pide un texto exacto, respetarlo literalmente.

## Tests

- Specs colocadas al lado del archivo: `servicios.spec.ts`.
- Usar Vitest (`describe`, `it`, `expect`, `vi`), no Jasmine.
- Para HTTP usar `provideHttpClientTesting()` y `HttpTestingController`.
- Cubrir, según la funcionalidad:
  - camino feliz,
  - carga / skeleton,
  - estado vacío,
  - error de API,
  - reintento conservando contexto,
  - casos de accesibilidad relevantes.
- Todo cambio de comportamiento debe traer o actualizar tests.
- No silenciar tests fallidos. Si no se pueden correr, reportarlo explícitamente.

## Contratos de API

- No inventar endpoints, campos ni códigos de error.
- Verificar el controller y el DTO reales del backend, o preguntar.
- Mantener los modelos del frontend alineados con los DTOs.
- Recordar que la mayoría de los endpoints requieren token Bearer; el `authInterceptor` lo agrega automáticamente.
- Si cambia un contrato, avisar y actualizar ambos repos.

## Definition of Done

- Criterios de aceptación cumplidos.
- Responsive y accesible.
- Tests nuevos o actualizados.
- `npm run build` y `npm test -- --watch=false` en verde.
- Sin errores nuevos en consola.
- PR con:
  - resumen,
  - criterios cubiertos,
  - cómo probar,
  - evidencias o URLs de demo,
  - riesgos o pendientes.
- Si falta un dato (ticket, URL, copy, contrato, diseño o credenciales), preguntar antes de inventarlo.
# AGENTS.md · appointmee-back

## Contexto

Backend de AppointMee: API REST para usuarios, sucursales, servicios, empleados y turnos.

- Repo actual: `appointmee/appointmee-back`
- El remote viejo `appointmee/AppointMee` redirige al nuevo.
- Java 21 + Spring Boot 4.0.5 + Maven
- PostgreSQL / Supabase
- JWT, Spring Security, Spring Data JPA
- Mercado Pago SDK
- Swagger/OpenAPI

## Comandos

Requiere Java 21 y `JAVA_HOME` configurado.

```bash
./mvnw spring-boot:run
./mvnw test
./mvnw -DskipTests package
```

Variables de entorno necesarias para la base:

```text
SPRING_DATASOURCE_URL
SPRING_DATASOURCE_USERNAME
SPRING_DATASOURCE_PASSWORD
```

Swagger local: `http://localhost:8080/swagger-ui.html`

Antes de commitear o pushear:

```bash
./mvnw test
```

No hay CI configurado en el repo: la verificación es local.

## Flujo de ramas

- `main`: rama estable / releases.
- `develop`: rama de integración.
- Todo desarrollo sale de `origin/develop` actualizado:

```bash
git fetch origin
git switch develop
git pull --ff-only
git switch -c SCRUM-<numero>-<descripcion-en-kebab-case>
```

- Nombre de rama: `SCRUM-229-ver-los-servicios-de-la-sucursal`.
- Nunca commitear directamente sobre `main` ni `develop`.
- El PR va siempre contra `develop`.
- Antes del PR, actualizar con `develop`, resolver conflictos y correr tests.
- No hacer `force-push` sobre ramas compartidas sin pedir confirmación.
- Si el ticket o el alcance no están claros, preguntar.

## Commits

Mismo formato que frontend:

```text
<tipo>(<scope>): <descripcion>
```

Tipos: `feat`, `fix`, `test`, `refactor`, `style`, `docs`, `chore`.

Scopes habituales: `auth`, `usuarios`, `sucursales`, `servicios`, `turnos`, `pagos`, `seguridad`, `observabilidad`.

Reglas:

- Descripción en español, clara y corta.
- Commits atómicos por funcionalidad.
- No mezclar refactors no pedidos con la feature.
- Stagear rutas explícitas y revisar `git diff --staged`.
- No commitear `target/`, `.env`, `application-local.properties`, secretos ni archivos de IDE.
- No commitear eliminaciones o cambios ajenos que ya estaban en el working tree.

## Código Java

- Paquete base: `com.gg.turnlook.Backend`.
- Capas existentes:
  - `Controllers`
  - `Service`
  - `Repository`
  - `DTO`
  - `Model`
  - `Excepciones`
  - `Security`
  - `config`
- No exponer entidades JPA: usar DTOs de request/response.
- Usar Lombok (`@Data`, `@AllArgsConstructor`, `@NoArgsConstructor`) como el resto del proyecto.
- Inyección por constructor. No field injection.
- Controllers con `ResponseEntity`, validación (`@Valid`) y `@PreAuthorize` cuando corresponda.
- Usar `@AuthenticationPrincipal` para el usuario autenticado.
- Precios con `BigDecimal`; duración en minutos con `Integer`.
- Mensajes de error en español mediante las excepciones del proyecto.
- No cambiar contratos existentes sin avisar al frontend.
- No agregar dependencias nuevas sin consultar.

## Seguridad

- `SecurityConfig` exige autenticación para todo lo que no esté explícitamente en `permitAll`.
- Los endpoints nuevos deben revisar si necesitan rol específico.
- No hardcodear credenciales ni tokens.
- No loguear datos sensibles.

## Tests

- Tests en `src/test/java`.
- Stack: JUnit + Spring Boot Test starters.
- Hoy existe un test de contexto; agregar tests específicos cuando se modifique lógica de servicio, controller o seguridad.
- Si el cambio requiere base de datos y no hay entorno disponible, usar perfil de test/H2 o reportar que no se pudo verificar.
- No silenciar tests fallidos.

## Definition of Done

- Criterios de aceptación cumplidos.
- Contrato de API documentado o avisado al frontend.
- Tests nuevos o actualizados.
- `./mvnw test` en verde (o limitación reportada).
- Sin secretos ni archivos locales en el commit.
- PR con resumen, endpoints afectados, cómo probar y riesgos.
- Si falta un dato (ticket, contrato, credenciales, entorno), preguntar antes de inventarlo.