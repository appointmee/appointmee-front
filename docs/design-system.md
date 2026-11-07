# Sistema de diseño AppointMee

Tokens centralizados y componentes reutilizables. Ver `src/app/shared/ui` y `src/styles.css`.

## Instalación/uso

Importar componentes standalone donde se necesiten:

```ts
import { DsButtonComponent } from './shared/ui/button/button.component';
```

Y usar en template:

```html
<button dsButton variant="primary" size="md">Guardar</button>
```

## Tokens

Definidos en `:root` en `src/styles.css`: colores, tipografía, espaciado, radios, sombras, breakpoints.

## Contraste WCAG AA

Combinaciones usadas y verificadas (texto normal >= 4,5:1; texto grande >= 3:1):

| Combinación | Ratio | AA normal | AA grande |
|---|---:|---|---|
| `--text` sobre `--page-bg` | 17,72:1 | ✅ | ✅ |
| `--muted` sobre `--page-bg` | 7,74:1 | ✅ | ✅ |
| `--accent` sobre `--page-bg` | 12,51:1 | ✅ | ✅ |
| `--page-bg` sobre `--accent` | 12,51:1 | ✅ | ✅ |
| `--danger` sobre `--page-bg` | 7,89:1 | ✅ | ✅ |
| `--text` sobre `--surface` | 16,83:1 | ✅ | ✅ |
| `--muted` sobre `--surface` | 7,35:1 | ✅ | ✅ |
| `--accent-strong` sobre `--page-bg` | 14,47:1 | ✅ | ✅ |
| `--success` sobre `--surface` | 9,00:1 | ✅ | ✅ |
| `--info` sobre `--surface` | 7,03:1 | ✅ | ✅ |
| `--danger` sobre `--surface` | 7,49:1 | ✅ | ✅ |
| `#07090d` sobre `--accent` (botón primario) | 12,51:1 | ✅ | ✅ |
| `#07090d` sobre `--danger` (botón peligro) | 7,89:1 | ✅ | ✅ |

Estados relevantes: hover usa `--accent-soft` manteniendo el color de texto; focus usa outline `--accent`; disabled usa opacidad 0,5 (no se usa para texto informativo); error usa `--danger` con ratio 7,89:1.

### Estados por componente

| Componente | Default | Hover | Focus | Active | Disabled | Loading | Error |
|---|---|---|---|---|---|---|---|
| Botón | Sí | Sí | Sí | Sí | Sí | Sí | No aplica: el error se comunica con `ds-alert`/`ds-toast` |
| Input | Sí | Sí | Sí | Sí | Sí | Sí | Sí |
| Select | Sí | Sí | Sí | Sí | Sí | No aplica | Sí |
| Checkbox / radio | Sí | Sí | Sí | Sí | Sí | No aplica | Sí |
| Card / badge | Sí | No aplica | No aplica | No aplica | No aplica | No aplica | No aplica |
| Alert / toast | Sí | No aplica | No aplica | No aplica | No aplica | No aplica | Sí: el alert representa error |
| Modal | Sí | No aplica | Sí | No aplica | No aplica | No aplica | No aplica |
| Skeleton / empty state | Sí | No aplica | No aplica | No aplica | No aplica | Skeleton representa carga | Empty state representa ausencia |
| Paginación | Sí | Heredado de botones nativos | Heredado de botones nativos | Heredado de botones nativos | Sí en límites | No aplica | No aplica |

La tabla describe estados aplicables; un estado que no tiene sentido para un componente se marca “No aplica”. La demo permite recorrer los controles con teclado, comprobar el foco visible y activar hover/active con puntero; sus ejemplos exponen carga, error y deshabilitado. Los ratios de texto sobre fondos translúcidos de badge, compuestos sobre `--surface`, son 7,00:1 para success, 5,67:1 para info y 6,04:1 para danger. Si se cambia la superficie, se debe recalcular el ratio.

## Demo

Ruta `/design-system` con ejemplos de botón, input, card, badge, alert, skeleton, empty state, paginación, select, checkbox, radio, toast y modal. Los estados no interactivos (hover, focus y active) se muestran al usar puntero/teclado; carga, error y disabled tienen ejemplos visibles.

### Alcance de aplicación

Los botones de las pantallas y diálogos usan `button[dsButton]`. El componente vive en el botón nativo: conserva estilos de la pantalla, clases dinámicas, atributos ARIA y el envío nativo de formularios. No se deben crear botones anidados ni copiar clases o atributos mediante manipulación del DOM.

Los campos de autenticación, búsqueda y configuración usan `ds-input`, que proyecta el control nativo para conservar los bindings y validaciones existentes. Si se proporciona `label`, asocia una etiqueta al control; si la pantalla ya tiene una etiqueta, se omite. Los errores y la carga pueden cambiar dinámicamente. La descripción del error se agrega sin perder los textos de ayuda existentes.

Los tokens y el foco visible son globales. Las tarjetas, avisos y diálogos específicos conservan sus composiciones; las piezas `ds-card`, badge, alert, toast, modal, skeleton, empty state y paginación están disponibles en la demo para nuevas pantallas. No se considera completada una migración de esas composiciones solo por importar un componente.

### Contratos de interacción

- Botón: variantes `primary`, `secondary` y `danger`; tamaños `sm`, `md` y `lg`; `disabled` y `loading` bloquean la activación. Usar `(click)` o `(clicked)`, nunca ambos para la misma acción. `type="submit"` funciona con Enter y con el botón.
- Checkbox: `[checked]`, `[value]` y `(checkedChange)`; admite `[(checked)]`.
- Radio: indicar siempre `name` por grupo y un `value` por opción. Vincular `[checked]` y `(valueChange)` al estado de la pantalla. Usar nombres diferentes para grupos independientes y un `fieldset` con `legend`.
- Card interactiva: `interactive` agrega rol y foco; `(activated)` funciona con clic, Enter y Espacio. Para navegación, preferir un enlace nativo y evitar controles anidados dentro de una card que actúe como botón.
- Modal: proporcionar `ariaLabel` o `ariaLabelledby`, controlar `[open]` y responder a `(close)`. El foco queda dentro; Escape solicita el cierre. El fondo se vuelve `inert` y se restaura al cerrar o destruir el modal.
- Breakpoints: `--bp-*` documenta los valores comunes. Las variables CSS no se sustituyen directamente en condiciones `@media`; usar los valores documentados.

### Verificación

`npm run e2e` incluye `e2e/design-system.spec.ts`: accesos del Home a 320, 390 y 1280 px, diseño y atributos del toggle de contraseña, foco del modal y contraste AA de las combinaciones de texto de los tokens sobre las superficies base. Esto no sustituye una revisión manual con lector de pantalla ni certifica cualquier combinación de colores creada por una pantalla.
