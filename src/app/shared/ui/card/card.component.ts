import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'ds-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<article class="ds-card"><ng-content></ng-content></article>`,
  styles: [`.ds-card{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-lg);padding:var(--space-4);box-shadow:var(--shadow-sm)}`],
})
export class DsCardComponent {}
