import {
  AfterViewChecked,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
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
    `.ds-badge{display:inline-block;padding:2px 8px;border-radius:var(--radius-full);font-size:var(--font-size-xs);background:var(--accent-soft);color:var(--accent)}.ds-badge--success{background:rgba(46,204,113,.15);color:#2ecc71}.ds-badge--danger{background:rgba(255,122,122,.15);color:var(--danger)}.ds-badge--info{background:rgba(90,160,247,.15);color:#5aa0f7}`,
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
        [attr.aria-label]="ariaLabel || null"
        [attr.aria-labelledby]="ariaLabelledby || null"
        tabindex="-1"
        (click)="$event.stopPropagation()"
        (keydown)="onKeydown($event)"
      >
        <ng-content></ng-content>
      </div>
    </div>
  }`,
  styles: [
    `.ds-modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:1000}.ds-modal{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-lg);padding:var(--space-4);max-width:500px;width:90%;max-height:90dvh;overflow:auto}.ds-modal:focus-visible{outline:2px solid var(--accent);outline-offset:2px}`,
  ],
})
export class DsModalComponent implements AfterViewChecked {
  @Input() open = false;
  @Input() ariaLabel = '';
  @Input() ariaLabelledby = '';
  @Output() close = new EventEmitter<void>();
  @ViewChild('dialog') private dialog?: ElementRef<HTMLElement>;
  private focused = false;

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open) this.requestClose();
  }

  ngAfterViewChecked(): void {
    if (this.open && !this.focused && this.dialog) {
      this.dialog.nativeElement.focus();
      this.focused = true;
    }
    if (!this.open) this.focused = false;
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Tab' || !this.dialog) return;
    const focusables = this.dialog.nativeElement.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
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
    <select class="ds-select" [id]="id" [disabled]="disabled">
      <ng-content></ng-content>
    </select>
  </label>`,
  styles: [
    `.ds-field{display:flex;flex-direction:column;gap:var(--space-1)}.ds-label{font-size:var(--font-size-sm);color:var(--muted)}.ds-select{padding:var(--space-2);border-radius:var(--radius-md);border:1px solid var(--line);background:var(--surface);color:var(--text)}`,
  ],
})
export class DsSelectComponent {
  readonly id = `ds-select-${++nextSelectId}`;
  @Input() label = '';
  @Input() disabled = false;
}

@Component({
  selector: 'ds-checkbox',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<label class="ds-checkbox"
    ><input type="checkbox" [disabled]="disabled" /><ng-content></ng-content
  ></label>`,
  styles: [`.ds-checkbox{display:inline-flex;gap:var(--space-2);align-items:center}`],
})
export class DsCheckboxComponent {
  @Input() disabled = false;
}

@Component({
  selector: 'ds-radio',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<label class="ds-radio"
    ><input type="radio" [disabled]="disabled" [name]="name" /><ng-content></ng-content
  ></label>`,
  styles: [`.ds-radio{display:inline-flex;gap:var(--space-2);align-items:center}`],
})
export class DsRadioComponent {
  @Input() disabled = false;
  @Input() name = 'ds-radio-group';
}
