import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormField, email, form, maxLength, minLength, pattern, required } from '@angular/forms/signals';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { ApiError } from '../../http/api-errors-service';
import { RegistroModel } from '../../models/registro';
import { authService } from '../../services/auth-service';

@Component({
  selector: 'app-registrarme',
  imports: [FormField, RouterLink],
  templateUrl: './registrarme.html',
  styleUrls: ['../login/login.css', './registrarme.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Registrarme {
  private auth = inject(authService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);

  registroModel = signal<RegistroModel>({
    nombre: '',
    apellido: '',
    email: '',
    confirmarEmail: '',
    password: '',
    confirmarPassword: '',
  });

  registroForm = form(this.registroModel, campos => {
    for (const campo of [campos.nombre, campos.apellido]) {
      required(campo, { message: 'Completá este campo.' });
      minLength(campo, 3, { message: 'Ingresá al menos 3 caracteres.' });
      maxLength(campo, 60, { message: 'El máximo es de 60 caracteres.' });
      pattern(campo, /^[a-zA-ZáéíóúÁÉÍÓÚñÑ ]+$/, { message: 'Usá solo letras y espacios.' });
    }

    for (const campo of [campos.email, campos.confirmarEmail]) {
      required(campo, { message: 'Ingresá tu email.' });
      email(campo, { message: 'Ingresá un email válido.' });
      minLength(campo, 8, { message: 'El email debe tener al menos 8 caracteres.' });
      maxLength(campo, 150, { message: 'El máximo es de 150 caracteres.' });
    }

    required(campos.password, { message: 'Ingresá una contraseña.' });
    minLength(campos.password, 8, { message: 'Usá al menos 8 caracteres.' });
    maxLength(campos.password, 67, { message: 'El máximo es de 67 caracteres.' });
    pattern(campos.password, /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@#$%&*!_-]).+$/, {
      message: 'Incluí una minúscula, una mayúscula, un número y un símbolo (@#$%&*!_-).',
    });
    required(campos.confirmarPassword, { message: 'Volvé a escribir tu contraseña.' });
  });

  cargando = signal(false);
  mostrarPassword = signal(false);
  mensaje = signal('');
  cuentaExistente = signal(false);
  puedeReintentar = signal(false);

  requisitosPassword = computed(() => {
    const password = this.registroModel().password;

    return [
      { texto: 'Entre 8 y 67 caracteres', cumplido: password.length >= 8 && password.length <= 67 },
      { texto: 'Una letra minúscula', cumplido: /[a-z]/.test(password) },
      { texto: 'Una letra mayúscula', cumplido: /[A-Z]/.test(password) },
      { texto: 'Un número', cumplido: /\d/.test(password) },
      { texto: 'Un símbolo (@#$%&*!_-)', cumplido: /[@#$%&*!_-]/.test(password) },
    ];
  });

  emailsCoinciden = computed(() => {
    const datos = this.registroModel();
    return datos.email.trim().toLowerCase() === datos.confirmarEmail.trim().toLowerCase();
  });

  passwordsCoinciden = computed(() => {
    const datos = this.registroModel();
    return datos.password === datos.confirmarPassword;
  });

  impedirPegado(event: Event): void {
    event.preventDefault();
  }

  onSubmit(event: Event): void {
    event.preventDefault();
    if (this.cargando()) return;

    this.registroModel.update(datos => ({
      ...datos,
      nombre: datos.nombre.trim(),
      apellido: datos.apellido.trim(),
      email: datos.email.trim().toLowerCase(),
      confirmarEmail: datos.confirmarEmail.trim().toLowerCase(),
    }));
    this.registroForm().markAsTouched();
    this.mensaje.set('');
    this.cuentaExistente.set(false);

    if (this.registroForm().invalid()) {
      const campos = [
        this.registroForm.nombre, this.registroForm.apellido,
        this.registroForm.email, this.registroForm.confirmarEmail,
        this.registroForm.password, this.registroForm.confirmarPassword,
      ];
      campos.find(campo => campo().invalid())?.().focusBoundControl();
      return;
    }

    if (!this.emailsCoinciden()) {
      this.registroForm.confirmarEmail().focusBoundControl();
      return;
    }

    if (!this.passwordsCoinciden()) {
      this.registroForm.confirmarPassword().focusBoundControl();
      return;
    }

    const { nombre, apellido, email, password } = this.registroModel();
    this.cargando.set(true);
    this.puedeReintentar.set(false);

    this.auth.registrar({ nombre, apellido, email, password })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.registroModel.update(datos => ({ ...datos, password: '', confirmarPassword: '' }));
          void this.router.navigate(['/login'], {
            queryParams: { returnTo: this.route.snapshot.queryParamMap.get('returnTo') },
            state: { registroExitoso: true },
          });
        },
        error: (error: ApiError) => {
          this.cargando.set(false);
          this.cuentaExistente.set(error.status === 409);
          if (error.status === 0 || error.status >= 500) {
            this.registroModel.update(datos => ({ ...datos, password: '', confirmarPassword: '' }));
            this.mostrarPassword.set(false);
            this.puedeReintentar.set(true);
            this.mensaje.set('No pudimos confirmar el registro. Conservamos tus datos; volvé a escribir ambas contraseñas para reintentar. Si la cuenta ya se creó, podés intentar iniciar sesión.');
            this.registroForm.password().focusBoundControl();
            return;
          }
          if (error.code === 'REGISTRATION_PENDING_VERIFICATION') {
            this.mensaje.set('Ya existe una cuenta pendiente de verificación con ese email. Volvé a iniciar sesión para verificarla o restablecé tu contraseña si no la recordás.');
            return;
          }
          this.mensaje.set(error.status === 409
            ? 'No pudimos crear la cuenta con ese email. Si ya tenés cuenta, iniciá sesión o recuperá tu contraseña.'
            : error.status === 400 || error.status === 422
              ? 'Revisá los datos ingresados y volvé a intentar.'
              : error.status === 429
                ? 'Demasiados intentos. Esperá un momento antes de reintentar.'
                : 'No pudimos confirmar el registro. Revisá tu conexión. Si la cuenta ya se creó, podés intentar iniciar sesión.');
        },
      });
  }
}
