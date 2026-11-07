import { booleanAttribute, ChangeDetectionStrategy, Component, EventEmitter, HostBinding, HostListener, Input, Output, ViewEncapsulation } from '@angular/core';

/** Botón nativo: conserva los estilos de la pantalla, el foco y el submit del formulario. */
@Component({
  selector: 'button[dsButton]',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  template: `@if (loading) { <span class="ds-spinner" aria-hidden="true"></span> }<ng-content></ng-content>`,
  styles: [`
    .ds-btn { display:inline-flex;align-items:center;justify-content:center;gap:var(--space-2);padding:var(--space-2) var(--space-4);border-radius:var(--radius-md);border:1px solid var(--line);background:var(--surface);color:var(--text);font:inherit;cursor:pointer }
    .ds-btn:hover:not(:disabled) { background:var(--accent-soft) }
    .ds-btn:focus-visible { outline:2px solid var(--accent);outline-offset:2px }
    .ds-btn:active:not(:disabled) { transform:translateY(1px) }
    .ds-btn:disabled { opacity:.5;cursor:not-allowed }
    .ds-btn--primary { background:var(--accent);color:var(--on-accent);border-color:var(--accent) }
    .ds-btn--primary:hover:not(:disabled) { background:var(--accent-strong) }
    .ds-btn--danger { background:var(--danger);color:var(--on-danger);border-color:var(--danger) }
    .ds-btn--danger:hover:not(:disabled) { background:var(--danger);filter:brightness(.96) }
    .ds-btn--sm { padding:var(--space-1) var(--space-2);font-size:var(--font-size-sm) }
    .ds-btn--lg { padding:var(--space-3) var(--space-6);font-size:var(--font-size-lg) }
    .ds-spinner { width:14px;height:14px;border:2px solid currentColor;border-top-color:transparent;border-radius:50%;animation:ds-spin .6s linear infinite }
    @keyframes ds-spin { to { transform:rotate(360deg) } }
    @media (prefers-reduced-motion:reduce) { .ds-spinner { animation:none } }
  `],
})
export class DsButtonComponent {
  @Input() variant: 'primary' | 'secondary' | 'danger' = 'secondary';
  @Input() size: 'sm' | 'md' | 'lg' = 'md';
  @Input() type: 'button' | 'submit' | 'reset' = 'button';
  @Input({ transform: booleanAttribute }) disabled = false;
  @Input({ transform: booleanAttribute }) loading = false;
  @Output() clicked = new EventEmitter<void>();

  @HostBinding('class.ds-btn') readonly baseClass = true;
  @HostBinding('class.ds-btn--primary') get primary() { return this.variant === 'primary'; }
  @HostBinding('class.ds-btn--danger') get danger() { return this.variant === 'danger'; }
  @HostBinding('class.ds-btn--sm') get small() { return this.size === 'sm'; }
  @HostBinding('class.ds-btn--lg') get large() { return this.size === 'lg'; }
  @HostBinding('type') get buttonType() { return this.type; }
  @HostBinding('disabled') get buttonDisabled() { return this.disabled || this.loading; }
  @HostBinding('attr.aria-busy') get busy() { return this.loading ? 'true' : null; }

  @HostListener('click', ['$event'])
  onClick(event: Event): void {
    if (this.disabled || this.loading) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    this.clicked.emit();
  }
}
