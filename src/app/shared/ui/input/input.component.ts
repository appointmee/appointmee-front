import {
  AfterContentInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  signal,
} from '@angular/core';

let nextId = 0;

/**
 * Envoltorio accesible para un control nativo proyectado.
 * Uso: <ds-input label="Email" error="Requerido"><input type="email" /></ds-input>
 */
@Component({
  selector: 'ds-input',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<label class="ds-field" [attr.for]="controlId()">
    @if (label) {
      <span class="ds-label">{{ label }}</span>
    }
    @if (loading && !controlId()) {
      <input
        class="ds-input"
        [placeholder]="placeholder"
        [disabled]="true"
        aria-busy="true"
        [attr.aria-label]="label || placeholder || 'Cargando'"
      />
    }
    <ng-content></ng-content>
    @if (error) {
      <span class="ds-error" [id]="errorId()" role="alert">{{ error }}</span>
    }
  </label>`,
  styles: [
    `:host{display:contents}.ds-field{display:flex;flex-direction:column;gap:var(--space-1)}.ds-label{font-size:var(--font-size-sm);color:var(--muted)}.ds-input{padding:var(--space-2) var(--space-3);border-radius:var(--radius-md);border:1px solid var(--line);background:var(--surface);color:var(--text)}.ds-error{color:var(--danger);font-size:var(--font-size-xs)}`,
  ],
})
export class DsInputComponent implements AfterContentInit {
  @Input() label = '';
  @Input() error = '';
  @Input() loading = false;
  @Input() placeholder = '';
  readonly controlId = signal('');
  readonly errorId = signal(`ds-input-error-${++nextId}`);

  constructor(private readonly host: ElementRef<HTMLElement>) {}

  ngAfterContentInit(): void {
    const control = this.host.nativeElement.querySelector<HTMLElement>(
      'input:not(.ds-input), select, textarea',
    );
    if (!control) return;
    if (!control.id) control.id = `ds-input-${nextId}`;
    this.controlId.set(control.id);
    if (this.loading) {
      control.setAttribute('aria-busy', 'true');
      control.setAttribute('disabled', '');
    }
    if (this.error) {
      control.setAttribute('aria-invalid', 'true');
      control.setAttribute('aria-describedby', this.errorId());
    }
  }
}
