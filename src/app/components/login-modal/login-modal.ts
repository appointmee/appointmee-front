import { ChangeDetectionStrategy, Component, ElementRef, afterNextRender, input, output, viewChild } from '@angular/core';
import { LoginPage } from '../../pages/login/login';

@Component({
  selector: 'app-login-modal',
  imports: [LoginPage],
  templateUrl: './login-modal.html',
  styleUrl: './login-modal.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginModal {
  destinoRetorno = input.required<string>();
  cerrar = output<void>();
  sesionIniciada = output<void>();
  private dialogo = viewChild.required<ElementRef<HTMLDialogElement>>('dialogo');

  constructor() {
    afterNextRender(() => {
      const dialogo = this.dialogo().nativeElement;
      dialogo.showModal();
      dialogo.querySelector<HTMLInputElement>('input')?.focus();
    });
  }
}
