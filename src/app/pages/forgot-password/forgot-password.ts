import { DsInputComponent } from '../../shared/ui/input/input.component';
import { DsButtonComponent } from '../../shared/ui/button/button.component';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormField, email, form, required } from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import { authService } from '../../services/auth-service';

@Component({
  selector: 'app-forgot-password',
  imports: [DsInputComponent, DsButtonComponent, FormField, RouterLink],
  templateUrl: './forgot-password.html',
  styleUrl: '../login/login.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForgotPasswordPage {

  private auth = inject(authService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  recoveryModel = signal({ email: '' });
  recoveryForm = form(this.recoveryModel, campos => {
    required(campos.email, { message: 'Ingresá tu email.' });
    email(campos.email, { message: 'Ingresá un email válido.' });
  });

  cargando = signal(false);
  enviado = signal(false);
  mensaje = signal('');
  error = signal(false);


  onSubmit(event: Event): void {
    event.preventDefault();
    if (this.cargando()) return;

    this.recoveryModel.update(datos => ({ email: datos.email.trim() }));
    this.recoveryForm().markAsTouched();
    if (this.recoveryForm().invalid()) {
      this.recoveryForm.email().focusBoundControl();
      return;
    }

    this.cargando.set(true);
    this.mensaje.set('');

    this.error.set(false);
    const email = this.recoveryModel().email;
    this.auth.solicitarRecuperacion(email).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.cargando.set(false);
        this.enviado.set(true);
        this.auth.guardarEmailRecuperacion(email);
        this.mensaje.set('Si el email está registrado, te enviamos un código de 6 dígitos. Revisá también spam');
        void this.router.navigate(['/reset-password'], { state: { mensajeRecuperacion: this.mensaje() } });
      },
      error: (error: { status?: number }) => {
        this.cargando.set(false);
        this.error.set(true);
        this.mensaje.set(error.status === 429
          ? 'Demasiadas solicitudes. Esperá un minuto e intentá nuevamente.'
          : 'No pudimos procesar la solicitud. Revisá tu conexión e intentá nuevamente.');
      },
    });
  }
}
