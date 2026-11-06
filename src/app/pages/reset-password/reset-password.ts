import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormField, form, maxLength, minLength, pattern, required } from '@angular/forms/signals';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { ApiError } from '../../http/api-errors-service';
import { RestablecerPasswordModel } from '../../models/restablecer-password';
import { authService } from '../../services/auth-service';

@Component({
  selector: 'app-reset-password',
  imports: [FormField, RouterLink],
  templateUrl: './reset-password.html',
  styleUrls: ['../login/login.css', './reset-password.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPasswordPage {
  private auth = inject(authService);
  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);
  private token = this.route.snapshot.queryParamMap.get('token') ?? '';

  enlaceInvalido = signal(!/^[A-Za-z0-9_-]{20,256}$/.test(this.token));
  cargando = signal(false);
  completado = signal(false);
  mostrarPassword = signal(false);
  mensaje = signal('');
  puedeReintentar = signal(false);

  passwordModel = signal<RestablecerPasswordModel>({ password: '', confirmarPassword: '' });

  passwordForm = form(this.passwordModel, campos => {
    required(campos.password, { message: 'Ingresá tu nueva contraseña.' });
    minLength(campos.password, 8, { message: 'Usá al menos 8 caracteres.' });
    maxLength(campos.password, 67, { message: 'El máximo es de 67 caracteres.' });
    pattern(campos.password, /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@#$%&*!_-]).+$/, {
      message: 'Incluí una minúscula, una mayúscula, un número y un símbolo (@#$%&*!_-).',
    });
    required(campos.confirmarPassword, { message: 'Volvé a escribir tu nueva contraseña.' });
  });

  coinciden = computed(() => this.passwordModel().password === this.passwordModel().confirmarPassword);

  requisitos = computed(() => {
    const password = this.passwordModel().password;
    return [
      { texto: 'Entre 8 y 67 caracteres', cumplido: password.length >= 8 && password.length <= 67 },
      { texto: 'Una letra minúscula', cumplido: /[a-z]/.test(password) },
      { texto: 'Una letra mayúscula', cumplido: /[A-Z]/.test(password) },
      { texto: 'Un número', cumplido: /\d/.test(password) },
      { texto: 'Un símbolo (@#$%&*!_-)', cumplido: /[@#$%&*!_-]/.test(password) },
    ];
  });

  onSubmit(event: Event): void {
    event.preventDefault();
    if (this.cargando() || this.completado() || this.enlaceInvalido()) return;
    this.passwordForm().markAsTouched();

    if (this.passwordForm().invalid() || !this.coinciden()) {
      const campo = this.passwordForm.password().invalid()
        ? this.passwordForm.password : this.passwordForm.confirmarPassword;
      campo().focusBoundControl();
      return;
    }

    this.cargando.set(true);
    this.mensaje.set('');
    this.puedeReintentar.set(false);

    this.auth.restablecerPassword(this.token, this.passwordModel().password)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.cargando.set(false);
          this.completado.set(true);
          this.token = '';
          this.passwordModel.set({ password: '', confirmarPassword: '' });
        },
        error: (error: ApiError) => {
          this.cargando.set(false);
          this.passwordModel.set({ password: '', confirmarPassword: '' });
          this.mostrarPassword.set(false);

          if ([400, 401, 403, 404, 410].includes(error.status)) {
            this.enlaceInvalido.set(true);
            this.token = '';
            return;
          }

          this.puedeReintentar.set(error.status === 0 || error.status >= 500);
          this.mensaje.set(error.status === 429
            ? 'Demasiados intentos. Esperá un momento antes de reintentar.'
            : 'No pudimos confirmar el cambio. Volvé a escribir ambas contraseñas para reintentar. Si el enlace ya se utilizó, intentá iniciar sesión o pedí uno nuevo.');
          this.passwordForm.password().focusBoundControl();
        },
      });
  }
}
