import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'ds-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<button
    [type]="type"
    [disabled]="disabled || loading"
    [attr.aria-busy]="loading"
    [attr.aria-label]="ariaLabel || null"
    class="ds-btn"
    [class.ds-btn--primary]="variant === 'primary'"
    [class.ds-btn--secondary]="variant === 'secondary'"
    [class.ds-btn--danger]="variant === 'danger'"
    [class.ds-btn--loading]="loading"
    (click)="clicked.emit()"
  >
    @if (loading) { <span class="ds-spinner" aria-hidden="true"></span> }
    <ng-content></ng-content>
  </button>`,
  styles: [`
    .ds-btn { display:inline-flex; align-items:center; justify-content:center; gap:var(--space-2); padding:var(--space-2) var(--space-4); border-radius:var(--radius-md); border:1px solid var(--line); background:var(--surface); color:var(--text); cursor:pointer; font:inherit; }
    .ds-btn:hover:not(:disabled) { background:var(--accent-soft); }
    .ds-btn:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
    .ds-btn:active:not(:disabled) { transform:scale(0.98); }
    .ds-btn:disabled { opacity:.5; cursor:not-allowed; }
    .ds-btn--primary { background:var(--accent); color:#07090d; border-color:var(--accent); }
    .ds-btn--danger { background:var(--danger); color:#07090d; border-color:var(--danger); }
    .ds-spinner { width:14px; height:14px; border:2px solid currentColor; border-top-color:transparent; border-radius:50%; animation:spin .6s linear infinite; }
    @keyframes spin { to { transform:rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .ds-spinner { animation:none; } }
  `],
})
export class DsButtonComponent {
  @Input() variant: 'primary' | 'secondary' | 'danger' = 'secondary';
  @Input() type: 'button' | 'submit' | 'reset' = 'button';
  @Input() disabled = false;
  @Input() loading = false;
  @Input() ariaLabel = '';
  @Output() clicked = new EventEmitter<void>();
}
