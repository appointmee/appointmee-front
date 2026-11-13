import {
  AfterViewChecked,
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  OnDestroy,
  ViewChild,
} from '@angular/core';

let nextSelectId = 0;

@Component({
  selector: 'ds-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span
    class="ds-badge"
    [class.ds-badge--info]="variant === 'info'"
    [class.ds-badge--success]="variant === 'success'"
    [class.ds-badge--danger]="variant === 'danger'"
    ><ng-content></ng-content
  ></span>`,
  styles: [
    `.ds-badge{display:inline-block;padding:2px 8px;border-radius:var(--radius-full);font-size:var(--font-size-xs);background:var(--accent-soft);color:var(--accent)}.ds-badge--success{background:var(--success-soft);color:var(--success)}.ds-badge--danger{background:rgba(255,122,122,.15);color:var(--danger)}.ds-badge--info{background:var(--info-soft);color:var(--info)}`,
  ],
})
export class DsBadgeComponent {
  @Input() variant: 'info' | 'success' | 'danger' | 'default' = 'default';
}

@Component({
  selector: 'ds-alert',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="ds-alert" role="alert" aria-live="assertive"><ng-content></ng-content></div>`,
  styles: [
    `.ds-alert{padding:var(--space-3);border-radius:var(--radius-md);border:1px solid var(--danger);background:rgba(255,122,122,.1);color:var(--text)}`,
  ],
})
export class DsAlertComponent {}

@Component({
  selector: 'ds-skeleton',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div
    class="ds-skeleton"
    [style.width]="width"
    [style.height]="height"
    aria-hidden="true"
  ></div>`,
  styles: [
    `.ds-skeleton{background:linear-gradient(90deg,var(--surface),var(--line),var(--surface));background-size:200% 100%;animation:shimmer 1.2s infinite;border-radius:var(--radius-md)}@keyframes shimmer{to{background-position:-200% 0}}@media(prefers-reduced-motion:reduce){.ds-skeleton{animation:none}}`,
  ],
})
export class DsSkeletonComponent {
  @Input() width = '100%';
  @Input() height = '1rem';
}

@Component({
  selector: 'ds-empty-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="ds-empty" role="status">
    <p>{{ message }}</p>
    <ng-content></ng-content>
  </div>`,
  styles: [`.ds-empty{text-align:center;padding:var(--space-8);color:var(--muted)}`],
})
export class DsEmptyStateComponent {
  @Input() message = 'Sin resultados';
}

@Component({
  selector: 'ds-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@if (open) {
    <div class="ds-modal-backdrop" (click)="requestClose()">
      <div
        #dialog
        class="ds-modal"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="ariaLabel || (ariaLabelledby ? null : 'Diálogo')"
        [attr.aria-labelledby]="ariaLabelledby || null"
        [style.max-width]="maxWidth"
        tabindex="-1"
        (click)="$event.stopPropagation()"
        (keydown)="onKeydown($event)"
      >
        <ng-content></ng-content>
      </div>
    </div>
  }`,
  styles: [
    `.ds-modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.62);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;z-index:1000;padding:var(--space-4)}.ds-modal{transform:translateY(var(--ds-modal-offset-y,0px));background:var(--ds-modal-background,var(--surface));border:1px solid var(--ds-modal-border-color,var(--line));border-radius:var(--ds-modal-radius,var(--radius-lg));box-shadow:var(--ds-modal-shadow,var(--shadow-md));padding:var(--ds-modal-padding,var(--space-4));max-width:500px;width:100%;max-height:90dvh;overflow:auto;overscroll-behavior:contain}.ds-modal:focus-visible{outline:var(--ds-modal-focus-outline,2px solid var(--accent));outline-offset:2px}`,
  ],
})
export class DsModalComponent implements AfterViewChecked, OnDestroy {
  private readonly background: HTMLElement[] = [];
  constructor(private readonly host: ElementRef<HTMLElement>) {}
  private isOpen = false;
  @Input() set open(value: boolean) {
    if (value && !this.isOpen) {
      // Un modal apilado pudo quedar inert por otro modal abierto antes.
      // Al abrirse debe poder recibir foco y eventos.
      this.host.nativeElement.removeAttribute('inert');
      this.previouslyFocused = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    } else if (!value && this.isOpen) {
      this.restoreBackground();
      this.previouslyFocused?.focus();
      this.previouslyFocused = null;
      this.focused = false;
    }
    this.isOpen = value;
  }
  get open(): boolean { return this.isOpen; }
  @Input() ariaLabel = '';
  @Input() ariaLabelledby = '';
  /** Ancho máximo del panel; la pantalla puede ampliarlo para contenido extenso. */
  @Input() maxWidth = '500px';
  @Output() close = new EventEmitter<void>();
  @ViewChild('dialog') private dialog?: ElementRef<HTMLElement>;
  private focused = false;
  private previouslyFocused: HTMLElement | null = null;

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open) this.requestClose();
  }

  ngAfterViewChecked(): void {
    if (this.open && !this.focused && this.dialog) {
      let current: HTMLElement | null = this.host.nativeElement;
      while (current?.parentElement) {
        for (const sibling of Array.from(current.parentElement.children)) {
          if (sibling !== current && sibling instanceof HTMLElement && !sibling.hasAttribute('inert')) {
            sibling.setAttribute('inert', '');
            this.background.push(sibling);
          }
        }
        if (current.parentElement === document.body) break;
        current = current.parentElement;
      }
      this.dialog.nativeElement.focus();
      this.focused = true;
    }
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Tab' || !this.dialog) return;
    const focusables = this.dialog.nativeElement.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (!focusables.length) {
      event.preventDefault();
      this.dialog.nativeElement.focus();
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === this.dialog.nativeElement)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  requestClose(): void {
    this.close.emit();
  }

  private restoreBackground(): void {
    for (const element of this.background) element.removeAttribute('inert');
    this.background.length = 0;
  }

  ngOnDestroy(): void {
    this.restoreBackground();
    if (this.open) this.previouslyFocused?.focus();
  }
}

@Component({
  selector: 'ds-pagination',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<nav class="ds-pagination" [attr.aria-label]="ariaLabel">
    <button type="button" (click)="prev()" [disabled]="page <= 1">{{ prevLabel }}</button>
    <span aria-live="polite">{{ pageLabel }} {{ page }} {{ ofLabel }} {{ totalPages }}</span>
    <button type="button" (click)="next()" [disabled]="page >= totalPages">{{ nextLabel }}</button>
  </nav>`,
  styles: [`.ds-pagination{display:flex;gap:var(--space-2);align-items:center}`],
})
export class DsPaginationComponent {
  @Input() page = 1;
  @Input() totalPages = 1;
  @Input() ariaLabel = 'Paginación';
  @Input() prevLabel = 'Anterior';
  @Input() nextLabel = 'Siguiente';
  @Input() pageLabel = 'Página';
  @Input() ofLabel = 'de';
  @Output() pageChange = new EventEmitter<number>();
  prev() {
    if (this.page > 1) {
      this.page--;
      this.pageChange.emit(this.page);
    }
  }
  next() {
    if (this.page < this.totalPages) {
      this.page++;
      this.pageChange.emit(this.page);
    }
  }
}

@Component({
  selector: 'ds-toast',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="ds-toast" role="status" aria-live="polite"><ng-content></ng-content></div>`,
  styles: [
    `.ds-toast{position:fixed;bottom:var(--space-4);right:var(--space-4);background:var(--surface);border:1px solid var(--line);padding:var(--space-3);border-radius:var(--radius-md);box-shadow:var(--shadow-md)}`,
  ],
})
export class DsToastComponent {}

@Component({
  selector: 'ds-select',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<label class="ds-field" [attr.for]="id">
    @if (label) { <span class="ds-label">{{ label }}</span> }
    <select class="ds-select" [id]="id" [value]="value" [disabled]="disabled" [attr.aria-invalid]="error ? 'true' : null" [attr.aria-describedby]="error ? id + '-error' : null" (change)="onChange($event)">
      <ng-content></ng-content>
    </select>
    @if (error) { <span class="ds-error" [id]="id + '-error'" role="alert">{{ error }}</span> }
  </label>`,
  styles: [
    `.ds-field{display:flex;flex-direction:column;gap:var(--space-1)}.ds-label{font-size:var(--font-size-sm);color:var(--muted)}.ds-select{padding:var(--space-2);border-radius:var(--radius-md);border:1px solid var(--line);background:var(--surface);color:var(--text)}.ds-select:hover:not(:disabled){border-color:var(--muted)}.ds-select:focus-visible{outline:2px solid var(--accent);outline-offset:2px}.ds-select:active:not(:disabled){border-color:var(--accent)}.ds-select:disabled{opacity:.6;cursor:not-allowed}.ds-select[aria-invalid=true]{border-color:var(--danger)}.ds-error{color:var(--danger);font-size:var(--font-size-xs)}`,
  ],
})
export class DsSelectComponent implements AfterViewInit {
  @Input() id = `ds-select-${++nextSelectId}`;
  @Input() label = '';
  @Input() disabled = false;
  @Input() error = '';
  @Input() value: string | number = '';
  @Output() change = new EventEmitter<Event>();
  constructor(private readonly host: ElementRef<HTMLElement>) {}
  ngAfterViewInit(): void {
    // The public id belongs to the native select, not the custom-element host.
    this.host.nativeElement.removeAttribute('id');
  }
  onChange(event: Event): void {
    event.stopPropagation();
    this.change.emit(event);
  }
}

@Component({
  selector: 'ds-checkbox',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<label class="ds-checkbox" [attr.for]="id"><input [id]="id" type="checkbox" [disabled]="disabled" [checked]="checked" [value]="value" (change)="onChange($event)" [attr.aria-invalid]="error ? 'true' : null" [attr.aria-describedby]="error ? id + '-error' : null" /><span><ng-content></ng-content></span></label>@if(error){<span class="ds-error" [id]="id + '-error'" role="alert">{{error}}</span>}`,
  styles: [`.ds-checkbox{display:inline-flex;gap:var(--space-2);align-items:center;cursor:pointer}.ds-checkbox:has(input:disabled){opacity:.6;cursor:not-allowed}.ds-checkbox input:focus-visible{outline:2px solid var(--accent);outline-offset:2px}`],
})
export class DsCheckboxComponent {
  readonly id = `ds-checkbox-${++nextSelectId}`;
  @Input() disabled = false;
  @Input() error = '';
  @Input() checked = false;
  @Input() value = 'on';
  @Output() checkedChange = new EventEmitter<boolean>();
  onChange(event: Event): void {
    this.checked = (event.target as HTMLInputElement).checked;
    this.checkedChange.emit(this.checked);
  }
}

@Component({
  selector: 'ds-radio',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<label class="ds-radio"
    ><input type="radio" [disabled]="disabled" [name]="name" [checked]="checked" [value]="value" (change)="onChange($event)" [attr.aria-invalid]="error ? 'true' : null" [attr.aria-describedby]="error ? id + '-error' : null" /><span><ng-content></ng-content></span
  ></label>@if(error){<span class="ds-error" [id]="id + '-error'" role="alert">{{error}}</span>}`,
  styles: [`.ds-radio{display:inline-flex;gap:var(--space-2);align-items:center;cursor:pointer}.ds-radio:hover input:not(:disabled){accent-color:var(--accent-strong)}.ds-radio:has(input:disabled){opacity:.6;cursor:not-allowed}.ds-radio input:focus-visible{outline:2px solid var(--accent);outline-offset:2px}.ds-radio input:active:not(:disabled){transform:scale(.96)}.ds-error{color:var(--danger);font-size:var(--font-size-xs)}`],
})
export class DsRadioComponent {
  readonly id = `ds-radio-${++nextSelectId}`;
  @Input() disabled = false;
  @Input({ required: true }) name = '';
  @Input() error = '';
  @Input() checked = false;
  @Input() value = '';
  @Output() valueChange = new EventEmitter<string>();
  onChange(event: Event): void {
    this.checked = (event.target as HTMLInputElement).checked;
    if (this.checked) this.valueChange.emit(this.value);
  }
}
