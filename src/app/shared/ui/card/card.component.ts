import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'ds-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<article class="ds-card" [class.ds-card--interactive]="interactive" [attr.tabindex]="interactive ? 0 : null"><ng-content></ng-content></article>`,
  styles: [`.ds-card{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-lg);padding:var(--space-4);box-shadow:var(--shadow-sm)}.ds-card--interactive{cursor:pointer;transition:transform .15s ease,box-shadow .15s ease}.ds-card--interactive:hover{transform:translateY(-2px);box-shadow:var(--shadow-md)}.ds-card--interactive:active{transform:translateY(0)}.ds-card--interactive:focus-visible{outline:2px solid var(--accent);outline-offset:2px}@media(prefers-reduced-motion:reduce){.ds-card--interactive{transition:none}}`],
})
export class DsCardComponent { @Input() interactive = false; }
