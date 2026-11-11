import {
  AfterContentInit,
  AfterContentChecked,
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
  template: `<div class="ds-field">
    @if (label) {
      <label class="ds-label" [attr.for]="controlId()">{{ label }}</label>
    }
    @if (loading && !controlId()) {
      <input
        class="ds-input"
        data-ds-fallback
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
  </div>`,
  styles: [
    `:host{display:contents}.ds-field{display:flex;flex-direction:column;gap:var(--space-1)}.ds-label{font-size:var(--font-size-sm);color:var(--muted)}.ds-input{padding:var(--space-2) var(--space-3);border-radius:var(--radius-md);border:1px solid var(--line);background:var(--surface);color:var(--text)}.ds-error{color:var(--danger);font-size:var(--font-size-xs)}`,
  ],
})
export class DsInputComponent implements AfterContentInit, AfterContentChecked {
  @Input() label = '';
  @Input() error = '';
  @Input() loading = false;
  @Input() placeholder = '';
  readonly controlId = signal('');
  readonly errorId = signal(`ds-input-error-${++nextId}`);
  private control?: HTMLInputElement;
  private previousError = false;
  private previousLoading = false;
  private wasDisabled = false;
  private previousInvalid: string | null = null;

  constructor(private readonly host: ElementRef<HTMLElement>) {}

  ngAfterContentInit(): void {
    const control = this.host.nativeElement.querySelector<HTMLElement>(
      'input:not([data-ds-fallback]), select, textarea',
    );
    if (!control) return;
    this.control = control as HTMLInputElement;
    if (!control.id) control.id = this.errorId().replace('ds-input-error-', 'ds-input-');
    this.controlId.set(control.id);
    this.ngAfterContentChecked();
  }

  ngAfterContentChecked(): void {
    const control = this.control;
    if (!control) return;
    if (!!this.error !== this.previousError) {
      const descriptions = new Set((control.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean));
      if (this.error) {
        this.previousInvalid = control.getAttribute('aria-invalid');
        control.setAttribute('aria-invalid', 'true');
        descriptions.add(this.errorId());
      } else {
        if (this.previousInvalid === null) control.removeAttribute('aria-invalid');
        else control.setAttribute('aria-invalid', this.previousInvalid);
        descriptions.delete(this.errorId());
      }
      if (descriptions.size) control.setAttribute('aria-describedby', [...descriptions].join(' '));
      else control.removeAttribute('aria-describedby');
      this.previousError = !!this.error;
    }
    if (this.loading !== this.previousLoading) {
      if (this.loading) {
        this.wasDisabled = control.disabled;
        control.disabled = true;
        control.setAttribute('aria-busy', 'true');
      } else {
        control.disabled = this.wasDisabled;
        control.removeAttribute('aria-busy');
      }
      this.previousLoading = this.loading;
    }
  }
}
