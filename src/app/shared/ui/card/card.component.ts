import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'ds-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<article class="ds-card" [class.ds-card--interactive]="interactive"
    [attr.role]="interactive ? 'button' : null" [attr.tabindex]="interactive ? 0 : null"
    (click)="activate($event)" (keydown)="onKeydown($event)"><ng-content></ng-content></article>`,
  styles: [`.ds-card{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-lg);padding:var(--space-4);box-shadow:var(--shadow-sm)}.ds-card--interactive{cursor:pointer;transition:transform .15s ease,box-shadow .15s ease}.ds-card--interactive:hover{transform:translateY(-2px);box-shadow:var(--shadow-md)}.ds-card--interactive:active{transform:translateY(0)}.ds-card--interactive:focus-visible{outline:2px solid var(--accent);outline-offset:2px}@media(prefers-reduced-motion:reduce){.ds-card--interactive{transition:none}}`],
})
export class DsCardComponent {
  @Input() interactive = false;
  @Output() activated = new EventEmitter<void>();

  activate(event: Event): void {
    if (this.interactive && event.target === event.currentTarget) this.activated.emit();
    else if (this.interactive && !(event.target as Element).closest('a, button, input, select, textarea')) {
      this.activated.emit();
    }
  }

  onKeydown(event: KeyboardEvent): void {
    if (!this.interactive || event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.activated.emit();
    }
  }
}
