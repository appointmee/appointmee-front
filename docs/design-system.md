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

Estados relevantes: hover usa `--accent-soft` manteniendo el color de texto; focus usa outline `--accent`; disabled usa opacidad 0,5 (no se usa para texto informativo); error usa `--danger` con ratio 7,89:1.

## Demo

Ruta `/design-system` con ejemplos de botón, input, card, badge, alert, skeleton, empty state, paginación, select, checkbox, radio, toast y modal.
