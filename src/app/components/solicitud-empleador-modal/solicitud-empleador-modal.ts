import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

const MINIMO_CARACTERES = 20;
const MAXIMO_CARACTERES = 300;

@Component({
  selector: 'app-solicitud-empleador-modal',
  templateUrl: './solicitud-empleador-modal.html',
  styleUrl: './solicitud-empleador-modal.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SolicitudEmpleadorModal {
  readonly enviando = input(false);
  readonly error = input<string | null>(null);
  readonly otroNegocio = input(false);
  private readonly confirmacionAceptada = signal(false);
  protected readonly requiereConfirmacion = computed(() => this.otroNegocio() && !this.confirmacionAceptada());

  readonly cerrar = output<void>();
  readonly confirmar = output<string>();
  readonly limpiarError = output<void>();

  protected readonly minimo = MINIMO_CARACTERES;
  protected readonly maximo = MAXIMO_CARACTERES;
  protected readonly motivo = signal('');
  protected readonly tocado = signal(false);

  protected readonly caracteres = computed(() => this.motivo().trim().length);
  protected readonly valido = computed(
    () => this.caracteres() >= MINIMO_CARACTERES && this.caracteres() <= MAXIMO_CARACTERES,
  );
  protected readonly puedeEnviar = computed(() => this.valido() && !this.enviando() && !this.requiereConfirmacion());
  protected readonly mostrarAyudaValidacion = computed(
    () => this.tocado() && !this.valido(),
  );

  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly dialogo = viewChild.required<ElementRef<HTMLDialogElement>>('dialogo');
  private readonly textarea = viewChild<ElementRef<HTMLTextAreaElement>>('textarea');

  constructor() {
    afterNextRender(() => {
      document.body.classList.add('modal-abierto');
      this.dialogo().nativeElement.showModal();
      this.textarea()?.nativeElement.focus();
      if (this.requiereConfirmacion()) this.dialogo().nativeElement.querySelector<HTMLButtonElement>('button')?.focus();
    });

    this.destroyRef.onDestroy(() => document.body.classList.remove('modal-abierto'));
  }

  protected confirmarOtroNegocio(): void {
    this.confirmacionAceptada.set(true);
    afterNextRender(() => this.textarea()?.nativeElement.focus(), { injector: this.injector });
  }

  protected actualizarMotivo(event: Event): void {
    const valor = (event.target as HTMLTextAreaElement).value;
    this.motivo.set(valor);

    if (this.error()) {
      this.limpiarError.emit();
    }
  }

  protected enviar(event: Event): void {
    event.preventDefault();
    this.tocado.set(true);

    if (!this.puedeEnviar()) {
      this.textarea()?.nativeElement.focus();
      return;
    }

    this.confirmar.emit(this.motivo().trim());
  }

  protected cerrarModal(): void {
    if (this.enviando()) return;
    this.cerrar.emit();
  }

  protected cancelar(event: Event): void {
    event.preventDefault();
    this.cerrarModal();
  }

  protected clickEnFondo(event: MouseEvent): void {
    if (event.target === this.dialogo().nativeElement) {
      this.cerrarModal();
    }
  }
}
