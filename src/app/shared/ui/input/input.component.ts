import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';

let nextId = 0;

@Component({
  selector: 'ds-input',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<label class="ds-field" [attr.for]="id">
    @if (label) { <span class="ds-label">{{ label }}</span> }
    <input
      [id]="id"
      [type]="type"
      [placeholder]="placeholder"
      [disabled]="disabled"
      [attr.aria-invalid]="error ? 'true' : null"
      [attr.aria-describedby]="error ? id + '-error' : null"
      [(ngModel)]="value"
      class="ds-input"
      [class.ds-input--error]="!!error"
    />
    @if (error) { <span class="ds-error" [id]="id + '-error'" role="alert">{{ error }}</span> }
  </label>`,
  styles: [`.ds-field{display:flex;flex-direction:column;gap:var(--space-1)}.ds-label{font-size:var(--font-size-sm);color:var(--muted)}.ds-input{padding:var(--space-2) var(--space-3);border-radius:var(--radius-md);border:1px solid var(--line);background:var(--surface);color:var(--text)}.ds-input:focus-visible{outline:2px solid var(--accent);outline-offset:2px}.ds-input--error{border-color:var(--danger)}.ds-error{color:var(--danger);font-size:var(--font-size-xs)}`],
})
export class DsInputComponent {
  readonly id = `ds-input-${++nextId}`;
  @Input() label = '';
  @Input() type = 'text';
  @Input() placeholder = '';
  @Input() disabled = false;
  @Input() error = '';
  value = '';
}
