import { DsInputComponent } from '../../shared/ui/input/input.component';
import { DsButtonComponent } from '../../shared/ui/button/button.component';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormField, form, maxLength, minLength, pattern, required } from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';

import { authService } from '../../services/auth-service';

interface ResetCodeModel {
  code: string;
  password: string;
  confirmarPassword: string;
}

@Component({
  selector: 'app-reset-password',
  imports: [DsInputComponent, DsButtonComponent, FormField, RouterLink],
  templateUrl: './reset-password.html',
  styleUrls: ['../login/login.css', './reset-password.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPasswordPage {
  private readonly auth = inject(authService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly email = this.auth.emailRecuperacionPendiente();
  readonly completado = signal(false);
  readonly cargando = signal(false);
  readonly mostrarPassword = signal(false);
  readonly mensaje = signal('');
  readonly puedeReintentar = signal(false);
  readonly modelo = signal<ResetCodeModel>({ code: '', password: '', confirmarPassword: '' });
  readonly codigoForm = form(this.modelo, fields => {
    required(fields.code, { message: 'Ingresá el código que recibiste por email.' });
    pattern(fields.code, /^\d{6}$/, { message: 'El código debe tener 6 dígitos.' });
    required(fields.password, { message: 'Ingresá tu nueva contraseña.' });
    minLength(fields.password, 8, { message: 'Usá al menos 8 caracteres.' });
    maxLength(fields.password, 67, { message: 'El máximo es de 67 caracteres.' });
    pattern(fields.password, /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@#$%&*!_-]).+$/, {
      message: 'Incluí una minúscula, una mayúscula, un número y un símbolo (@#$%&*!_-).',
    });
    required(fields.confirmarPassword, { message: 'Volvé a escribir tu nueva contraseña.' });
  });

  readonly coinciden = computed(() => this.modelo().password === this.modelo().confirmarPassword);
  readonly requisitos = computed(() => {
    const password = this.modelo().password;
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
    if (!this.email || this.cargando() || this.completado()) return;
    this.codigoForm().markAsTouched();
    if (this.codigoForm().invalid() || !this.coinciden()) {
      const campo = this.codigoForm.code().invalid()
        ? this.codigoForm.code
        : this.codigoForm.password().invalid()
          ? this.codigoForm.password
          : this.codigoForm.confirmarPassword;
      campo().focusBoundControl();
      return;
    }

    this.cargando.set(true);
    this.mensaje.set('');
    this.puedeReintentar.set(false);
    const { code, password } = this.modelo();
    this.auth.restablecerPassword(this.email, code, password)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.cargando.set(false);
          this.completado.set(true);
          this.modelo.set({ code: '', password: '', confirmarPassword: '' });
          void this.router.navigate(['/login'], { replaceUrl: true, state: { passwordActualizada: true } });
        },
        error: (error: { status?: number }) => {
          this.cargando.set(false);
          this.modelo.update(actual => ({ ...actual, password: '', confirmarPassword: '' }));
          this.mostrarPassword.set(false);
          this.puedeReintentar.set(error.status === 0 || (error.status ?? 0) >= 500);
          this.mensaje.set(error.status === 429
            ? 'Demasiados intentos. Esperá un momento antes de reintentar.'
            : error.status === 400
              ? 'El código es inválido, venció o se agotaron los intentos. Solicitá uno nuevo para continuar.'
              : 'No pudimos confirmar el cambio. Revisá tu conexión e intentá nuevamente.');
          this.codigoForm.password().focusBoundControl();
        },
      });
  }
}
