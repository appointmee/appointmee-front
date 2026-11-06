import { Component, inject, signal } from '@angular/core';
import { FormField, email, form, required } from '@angular/forms/signals';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { authService } from '../../services/auth-service';

@Component({
  selector: 'app-forgot-password',
  imports: [FormField, RouterLink],
  templateUrl: './forgot-password.html',
  styleUrl: '../login/login.css',
})
export class ForgotPasswordPage {

  private auth = inject(authService);
  private route = inject(ActivatedRoute);

  recoveryModel = signal({ email: this.route.snapshot.queryParamMap.get('email') ?? '' });
  recoveryForm = form(this.recoveryModel, campos => {
    required(campos.email, { message: 'Ingresá tu email.' });
    email(campos.email, { message: 'Ingresá un email válido.' });
  });

  cargando = signal(false);
  enviado = signal(false);
  mensaje = signal('');


  onSubmit(event: Event): void {
    event.preventDefault();
    if (this.cargando()) return;

    this.recoveryModel.update(datos => ({ email: datos.email.trim() }));
    this.recoveryForm().markAsTouched();
    if (this.recoveryForm().invalid()) return;

    this.cargando.set(true);
    this.mensaje.set('');

    this.auth.solicitarRecuperacion(this.recoveryModel().email).subscribe({
      next: () => {
        this.cargando.set(false);
        this.enviado.set(true);
        this.mensaje.set('Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.');
      },
      error: () => {
        this.cargando.set(false);
        this.mensaje.set('No pudimos procesar la solicitud. Esperá un momento e intentá nuevamente.');
      },
    });
  }
}
