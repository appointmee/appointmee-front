# Sistema de diseño AppointMee

Tokens centralizados y componentes reutilizables. Ver `src/app/shared/ui` y `src/styles.css`.

## Instalación/uso

Importar componentes standalone donde se necesiten:

```ts
import { DsButtonComponent } from './shared/ui/button/button.component';
```

Y usar en template:

```html
<ds-button variant="primary" size="md">Guardar</ds-button>
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
| Input | Sí | Sí | Sí | Sí | Sí | No aplica | Sí |
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

Los botones, campos de entrada y selectores de las pantallas están integrados con los componentes `ds-button`, `ds-input` y `ds-select`; `ds-input` proyecta el control nativo para conservar los bindings reactivos, atributos y validaciones existentes. Los tokens y el foco visible son globales. Inicio, sucursales/detalle, servicios, autenticación/registro, configuración, errores/404 y diálogos usan estos componentes o controles nativos ya integrados en `ds-input`. Los demás componentes (`ds-card`, badge, alert, toast, modal, skeleton, empty state, paginación, checkbox y radio) están disponibles como piezas reutilizables y tienen ejemplos en la demo.
