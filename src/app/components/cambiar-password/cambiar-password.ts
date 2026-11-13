import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormField, form, maxLength, minLength, pattern, required } from '@angular/forms/signals';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { esPasswordActualIncorrecta } from '../../http/password-change-error';
import { authService } from '../../services/auth-service';
import { ApiError } from '../../http/api-errors-service';
import { CambiarPasswordModel } from '../../models/cambiar-password';
import { DsButtonComponent } from '../../shared/ui/button/button.component';
import { DsInputComponent } from '../../shared/ui/input/input.component';

@Component({
  selector: 'app-cambiar-password',
  imports: [FormField, DsButtonComponent, DsInputComponent],
  templateUrl: './cambiar-password.html',
  styleUrls: ['../../pages/login/login.css', '../../pages/reset-password/reset-password.css', './cambiar-password.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CambiarPassword {
  private auth = inject(authService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  passwordModel = signal<CambiarPasswordModel>({ actual: '', nueva: '', confirmar: '' });
  cargando = signal(false);
  cerrandoSesion = signal(false);
  mostrarActual = signal(false);
  mostrarNueva = signal(false);
  recuperar = signal(false);
  mensaje = signal('');

  passwordForm = form(this.passwordModel, campos => {
    required(campos.actual, { message: 'Ingresá tu contraseña actual.' });
    maxLength(campos.actual, 256, { message: 'Revisá tu contraseña actual.' });
    required(campos.nueva, { message: 'Ingresá una nueva contraseña.' });
    minLength(campos.nueva, 8, { message: 'Usá al menos 8 caracteres.' });
    maxLength(campos.nueva, 67, { message: 'El máximo es de 67 caracteres.' });
    pattern(campos.nueva, /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@#$%&*!_-]).+$/, {
      message: 'Incluí minúscula, mayúscula, número y símbolo (@#$%&*!_-).',
    });
    required(campos.confirmar, { message: 'Volvé a escribir la nueva contraseña.' });
  });

  coinciden = computed(() => this.passwordModel().nueva === this.passwordModel().confirmar);
  requisitos = computed(() => {
    const nueva = this.passwordModel().nueva;
    return [
      { texto: 'Entre 8 y 67 caracteres', cumplido: nueva.length >= 8 && nueva.length <= 67 },
      { texto: 'Una letra minúscula', cumplido: /[a-z]/.test(nueva) },
      { texto: 'Una letra mayúscula', cumplido: /[A-Z]/.test(nueva) },
      { texto: 'Un número', cumplido: /\d/.test(nueva) },
      { texto: 'Un símbolo (@#$%&*!_-)', cumplido: /[@#$%&*!_-]/.test(nueva) },
    ];
  });

  onSubmit(event: Event): void {
    event.preventDefault();
    if (this.cargando() || this.cerrandoSesion()) return;
    this.passwordForm().markAsTouched();
    this.mensaje.set('');
    if (this.passwordForm().invalid()) {
      const campo = this.passwordForm.actual().invalid() ? this.passwordForm.actual
        : this.passwordForm.nueva().invalid() ? this.passwordForm.nueva : this.passwordForm.confirmar;
      campo().focusBoundControl();
      return;
    }
    if (!this.coinciden()) {
      this.passwordForm.confirmar().focusBoundControl();
      return;
    }
    const datos = this.passwordModel();
    if (datos.actual === datos.nueva) {
      this.mensaje.set('La nueva contraseña debe ser distinta de la actual.');
      this.passwordForm.nueva().focusBoundControl();
      return;
    }
    this.cargando.set(true);
    this.auth.cambiarPassword(datos.actual, datos.nueva)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.limpiarCampos();
          this.auth.limpiarSesion();
          void this.router.navigate(['/login'], { replaceUrl: true, state: { passwordActualizada: true, passwordDesdeAjustes: true } });
        },
        error: (error: ApiError | HttpErrorResponse) => {
          this.cargando.set(false);
          this.limpiarCampos();
          const code = error instanceof HttpErrorResponse ? error.error?.code : error.code;
          this.mensaje.set(code === 'CURRENT_PASSWORD_INVALID' || esPasswordActualIncorrecta(error)
            ? 'La contraseña actual es incorrecta.'
            : code === 'NEW_PASSWORD_REUSED'
              ? 'La nueva contraseña debe ser distinta de la actual.'
              : error.status === 429 ? 'Demasiados intentos. Esperá un momento antes de reintentar.'
                : error.status === 400 ? 'Revisá la contraseña actual y los requisitos de la nueva contraseña.'
                  : 'No pudimos confirmar el cambio. Volvé a escribir las contraseñas para reintentar.');
          this.passwordForm.actual().focusBoundControl();
        },
      });
  }

  cerrarParaRecuperar(): void {
    if (this.cargando() || this.cerrandoSesion()) return;
    this.cerrandoSesion.set(true);
    this.limpiarCampos();
    const continuar = () => {
      this.auth.limpiarSesion();
      void this.router.navigate(['/olvide-mi-contrasena'], { replaceUrl: true });
    };
    this.auth.logout().pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ complete: continuar, error: continuar });
  }

  private limpiarCampos(): void {
    this.passwordModel.set({ actual: '', nueva: '', confirmar: '' });
    this.mostrarActual.set(false);
    this.mostrarNueva.set(false);
  }
}
