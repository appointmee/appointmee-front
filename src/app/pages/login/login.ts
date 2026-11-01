import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormField, email, form, required } from '@angular/forms/signals';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { CuentaSinVerificarModal } from '../../components/cuenta-sin-verificar-modal/cuenta-sin-verificar-modal';
import { LoginModel } from '../../models/auth';
import { ApiError } from '../../http/api-errors-service';
import { authService } from '../../services/auth-service';
import { destinoDespuesDelLogin } from '../../guards/login-destination';

@Component({
  selector: 'app-login',
  imports: [FormField, RouterLink, CuentaSinVerificarModal],
  templateUrl: './login.html',
  styleUrl: './login.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPage {

  private auth = inject(authService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);


  loginModel = signal<LoginModel>({
    email: '',
    password: '',
  });

  loginForm = form(this.loginModel, (campos) => {
    required(campos.email, { message: 'Ingresá tu email.' });
    email(campos.email, { message: 'Ingresá un email válido.' });

    required(campos.password, { message: 'Ingresá tu contraseña.' });
  });


  cargando = signal(false);
  mostrarPassword = signal(false);
  puedeReintentar = signal(false);
  emailSinVerificar = signal(false);
  modalVerificacion = signal(false);

  mensaje = signal(
    this.route.snapshot.queryParamMap.get('expired') === '1'
      ? 'Tu sesión expiró. Iniciá sesión para continuar.'
      : '',
  );


  onSubmit(event: Event): void {
    event.preventDefault();

    if (this.cargando()) return;

    this.loginModel.update(datos => ({ ...datos, email: datos.email.trim() }));
    this.loginForm().markAsTouched();

    if (this.loginForm().invalid()) {
      const campo = this.loginForm.email().invalid() ? this.loginForm.email : this.loginForm.password;
      campo().focusBoundControl();
      return;
    }

    this.cargando.set(true);
    this.mensaje.set('');
    this.puedeReintentar.set(false);
    this.emailSinVerificar.set(false);
    this.modalVerificacion.set(false);

    const datos = this.loginModel();

    this.auth.login(datos.email, datos.password).subscribe({
      next: () => {
        this.cargando.set(false);

        const destino = destinoDespuesDelLogin(this.router, this.route.snapshot.queryParamMap.get('returnTo'));
        void this.router.navigateByUrl(destino);
      },

      error: (error: ApiError) => {
        this.cargando.set(false);
        this.mostrarError(error);
      },
    });
  }


  irAVerificar(): void {
    this.modalVerificacion.set(false);

    void this.router.navigate(['/configuracion/verificar-email'], {
      queryParams: { email: this.loginModel().email },
    });
  }


  private mostrarError(error: ApiError): void {
    if (error.code === 'EMAIL_NOT_VERIFIED') {
      this.emailSinVerificar.set(true);
      this.modalVerificacion.set(true);
      this.mensaje.set('Tu cuenta todavía no está verificada. Verificá tu email para iniciar sesión.');
      return;
    }

    if (error.status === 401) {
      this.mensaje.set('Email o contraseña incorrectos');
      this.loginModel.update(datos => ({ ...datos, password: '' }));
      this.loginForm.password().focusBoundControl();
      return;
    }

    if (error.status === 429) {
      this.mensaje.set(error.retryAfterSeconds
        ? `Demasiados intentos. Esperá ${error.retryAfterSeconds} segundos antes de reintentar.`
        : 'Demasiados intentos. Esperá un momento antes de reintentar.');
      return;
    }

    this.puedeReintentar.set(error.status === 0 || error.status >= 500);
    this.mensaje.set(error.status === 0
      ? 'No pudimos conectarnos. Revisá tu conexión y volvé a intentar.'
      : 'No pudimos iniciar sesión. Intentá nuevamente en unos momentos.');
  }
}
