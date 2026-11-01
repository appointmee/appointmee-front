import { ChangeDetectionStrategy, Component, ElementRef, afterNextRender, input, output, viewChild } from '@angular/core';

@Component({
  selector: 'app-cuenta-sin-verificar-modal',
  templateUrl: './cuenta-sin-verificar-modal.html',
  styleUrl: './cuenta-sin-verificar-modal.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CuentaSinVerificarModal {

  email = input.required<string>();

  aceptar = output<void>();
  cancelar = output<void>();

  private dialogo = viewChild.required<ElementRef<HTMLDialogElement>>('dialogo');


  constructor() {
    // El diálogo nativo mantiene el foco dentro del modal y permite cerrar con Escape.
    afterNextRender(() => this.dialogo().nativeElement.showModal());
  }
}
