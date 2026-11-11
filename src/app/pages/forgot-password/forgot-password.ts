import { DsInputComponent } from '../../shared/ui/input/input.component';
import { DsButtonComponent } from '../../shared/ui/button/button.component';
import { Component, inject, signal } from '@angular/core';
import { FormField, email, form, required } from '@angular/forms/signals';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { authService } from '../../services/auth-service';

@Component({
  selector: 'app-forgot-password',
  imports: [DsInputComponent, DsButtonComponent, FormField, RouterLink],
  templateUrl: './forgot-password.html',
  styleUrl: '../login/login.css',
})
export class ForgotPasswordPage {
  private auth = inject(authService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  recoveryModel = signal({ email: this.route.snapshot.queryParamMap.get('email') ?? '' });
  recoveryForm = form(this.recoveryModel, campos => {
    required(campos.email, { message: 'Ingresá tu email.' });
    email(campos.email, { message: 'Ingresá un email válido.' });
  });

  cargando = signal(false);
  enviado = signal(false);
  mensaje = signal('');
  error = signal<string | null>(null);
  puedeReintentar = signal(false);

  onSubmit(event: Event): void {
    event.preventDefault();
    if (this.cargando()) return;

    this.recoveryModel.update(datos => ({ email: datos.email.trim() }));
    this.recoveryForm().markAsTouched();
    if (this.recoveryForm().invalid()) return;

    this.cargando.set(true);
    this.mensaje.set('');
    this.error.set(null);
    this.puedeReintentar.set(false);

    this.auth.solicitarRecuperacion(this.recoveryModel().email).subscribe({
      next: () => {
        this.cargando.set(false);
        this.enviado.set(true);
        this.mensaje.set('Si el email está registrado, te enviamos un código de 6 dígitos. Revisá también spam.');
      },
      error: (err: HttpErrorResponse) => {
        this.cargando.set(false);
        if (err.status === 429) {
          this.error.set('Demasiados intentos. Esperá un momento antes de reintentar.');
          this.puedeReintentar.set(true);
          return;
        }
        this.error.set('No pudimos procesar la solicitud. Revisá tu conexión e intentá nuevamente.');
        this.puedeReintentar.set(err.status === 0 || err.status >= 500);
      },
    });
  }

  reintentar(): void {
    this.onSubmit(new Event('submit', { cancelable: true }));
  }
}
