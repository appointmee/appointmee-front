import {
  AfterViewChecked,
  Attribute,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  HostBinding,
  HostListener,
  Input,
  Output,
  ViewChild,
} from '@angular/core';

@Component({
  selector: 'ds-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<button
    #btn
    [type]="type"
    [disabled]="disabled || loading"
    [attr.aria-busy]="loading"
    [attr.aria-label]="ariaLabel || null"
    [attr.aria-controls]="ariaControls || null"
    [attr.aria-expanded]="ariaExpanded"
    [attr.aria-pressed]="ariaPressed"
    [class]="classes"
    (click)="clicked.emit()"
  >
    @if (loading) {
      <span class="ds-spinner" aria-hidden="true"></span>
    }
    <ng-content></ng-content>
  </button>`,
  styles: [
    `:host{display:contents}
    .ds-btn{display:inline-flex;align-items:center;justify-content:center;gap:var(--space-2);padding:var(--space-2) var(--space-4);border-radius:var(--radius-md);border:1px solid var(--line);background:var(--surface);color:var(--text);cursor:pointer;font:inherit}
    .ds-btn:hover:not(:disabled){background:var(--accent-soft)}
    .ds-btn--primary:hover:not(:disabled){background:var(--accent-strong)}
    .ds-btn--danger:hover:not(:disabled){background:var(--danger);filter:brightness(.96)}
    .ds-btn:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
    .ds-btn:active:not(:disabled){transform:scale(0.98)}
    .ds-btn:disabled{opacity:.5;cursor:not-allowed}
    .ds-btn--primary{background:var(--accent);color:var(--on-accent);border-color:var(--accent)}
    .ds-btn--danger{background:var(--danger);color:var(--on-danger);border-color:var(--danger)}
    .ds-spinner{width:14px;height:14px;border:2px solid currentColor;border-top-color:transparent;border-radius:50%;animation:spin .6s linear infinite}
    @keyframes spin{to{transform:rotate(360deg)}}
    @media (prefers-reduced-motion:reduce){.ds-spinner{animation:none}}`,
  ],
})
export class DsButtonComponent implements AfterViewChecked {
  @Input() variant: 'primary' | 'secondary' | 'danger' = 'secondary';
  @Input() type: 'button' | 'submit' | 'reset' = 'button';
  @Input() disabled = false;
  @Input() loading = false;
  @Input() ariaLabel = '';
  @Input() ariaPressed: string | null = null;
  @Output() clicked = new EventEmitter<void>();
  @ViewChild('btn') private readonly button?: ElementRef<HTMLButtonElement>;
  private readonly hostClasses: string[];
  private classesMoved = false;

  @HostBinding('type') get hostType() {
    return this.type;
  }
  @HostBinding('disabled') get hostDisabled() {
    return this.disabled || this.loading;
  }

  constructor(
    private readonly host: ElementRef<HTMLElement>,
    @Attribute('class') hostClass: string | null,
    @Attribute('aria-controls') readonly ariaControls: string | null,
    @Attribute('aria-expanded') readonly ariaExpanded: string | null,
  ) {
    this.hostClasses = (hostClass ?? '').split(/\s+/).filter(Boolean);
  }

  @HostListener('click', ['$event'])
  onHostClick(event: MouseEvent): void {
    const button = this.button?.nativeElement;
    if (!button || event.target !== this.host.nativeElement) return;
    if (this.type === 'submit') {
      button.form?.requestSubmit(button);
    }
  }

  ngAfterViewChecked(): void {
    const host = this.host.nativeElement;
    const button = this.button?.nativeElement;
    if (!button) return;

    if (!this.classesMoved) {
      for (const name of this.hostClasses) host.classList.remove(name);
      this.classesMoved = true;
    }

    if (this.loading) {
      button.setAttribute('aria-busy', 'true');
    } else {
      const busy = host.getAttribute('aria-busy');
      if (busy !== null) button.setAttribute('aria-busy', busy);
      else button.removeAttribute('aria-busy');
    }

    const label = host.getAttribute('aria-label');
    if (label !== null) button.setAttribute('aria-label', label);
    else if (this.ariaLabel) button.setAttribute('aria-label', this.ariaLabel);
    else button.removeAttribute('aria-label');

    for (const attr of [
      'aria-controls',
      'aria-describedby',
      'aria-expanded',
      'aria-pressed',
      'title',
    ]) {
      const value = host.getAttribute(attr);
      if (value !== null) button.setAttribute(attr, value);
      else button.removeAttribute(attr);
    }
  }

  get classes(): string {
    const variant =
      this.variant === 'primary'
        ? 'ds-btn--primary'
        : this.variant === 'danger'
          ? 'ds-btn--danger'
          : 'ds-btn--secondary';
    return `ds-btn ${variant} ${this.hostClasses.join(' ')}`.trim();
  }
}
