import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  output,
  signal
} from '@angular/core';

import { DsInputComponent } from '../../shared/ui/input/input.component';
import { DsButtonComponent } from '../../shared/ui/button/button.component';

import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormField, email, form, required } from '@angular/forms/signals';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { CuentaSinVerificarModal } from '../../components/cuenta-sin-verificar-modal/cuenta-sin-verificar-modal';
import { verificacionPendienteService } from '../../services/verificacion-pendiente-service';
import { LoginModel } from '../../models/auth';
import { ApiError } from '../../http/api-errors-service';
import { authService } from '../../services/auth-service';
import { destinoDespuesDelLogin } from '../../guards/login-destination';
@Component({
  selector: 'app-login',
  imports: [DsInputComponent, DsButtonComponent, FormField, RouterLink, CuentaSinVerificarModal],
  templateUrl: './login.html',
  styleUrl: './login.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPage {

  private auth = inject(authService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private pendiente = inject(verificacionPendienteService);
  private destroyRef = inject(DestroyRef);

  modoModal = input(false);
  destinoRetorno = input<string | null>(null);
  sesionIniciada = output<void>();


  loginModel = signal<LoginModel>({
    email: '',
    password: '',
  });

  loginForm = form(this.loginModel, (campos) => {
    required(campos.email, { message: 'Ingresá tu email.' });
    email(campos.email, { message: 'Ingresá un email válido.' });

    required(campos.password, { message: 'Ingresá tu contraseña.' });
  });


  registroExitoso = signal(this.router.getCurrentNavigation()?.extras.state?.['registroExitoso'] === true);

  cargando = signal(false);
  erroresBackend = signal<Record<string, string>>({});
  resumenErrores = computed(() => {
    const lista: { id: string; label: string; message: string }[] = [];
    if (this.loginForm.email().touched() && this.loginForm.email().invalid()) {
      lista.push({ id: 'login-email', label: 'Email', message: this.loginForm.email().errors()[0]?.message ?? 'Revisá este campo.' });
    }
    if (this.loginForm.password().touched() && this.loginForm.password().invalid()) {
      lista.push({ id: 'login-password', label: 'Contraseña', message: this.loginForm.password().errors()[0]?.message ?? 'Revisá este campo.' });
    }
    return lista;
  });
  mostrarPassword = signal(false);
  puedeReintentar = signal(false);
  emailSinVerificar = signal(false);
  modalVerificacion = signal(false);

  mensaje = signal(
    this.route.snapshot.queryParamMap.get('expired') === '1'
      ? 'Tu sesión expiró. Iniciá sesión para continuar.'
      : /servicio|turno|reserva/i.test(this.route.snapshot.queryParamMap.get('returnTo') ?? '')
        ? 'Iniciá sesión para reservar tu turno.'
        : '',
  );


  onSubmit(event: Event): void {
    event.preventDefault();

    if (this.cargando()) return;

    this.loginModel.update(datos => ({ ...datos, email: datos.email.trim() }));
    this.loginForm().markAsTouched();
    this.erroresBackend.set({});

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

    this.auth.login(datos.email, datos.password).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.cargando.set(false);

        if (this.modoModal()) {
          this.sesionIniciada.emit();
          return;
        }

        const destino = destinoDespuesDelLogin(
          this.router,
          this.route.snapshot.queryParamMap.get('returnTo'),
          (typeof this.auth.perfil === 'function'
            ? this.auth.perfil()?.roles
            : []) ?? []
        );

        void this.router.navigateByUrl(destino, { replaceUrl: true });
      },

      error: (error: ApiError) => {
        this.cargando.set(false);
        this.mostrarError(error);
      },
    });
  }


  irAVerificar(): void {
    this.modalVerificacion.set(false);
    const returnTo = this.destinoRetorno() ?? this.route.snapshot.queryParamMap.get('returnTo');
    void this.router.navigate(['/configuracion/verificar-email'], returnTo ? { queryParams: { returnTo } } : undefined);
  }


  cancelarVerificacion(): void {
    this.pendiente.limpiar();
    this.modalVerificacion.set(false);
  }


  private mostrarError(error: ApiError): void {
    if (error.fields && Object.keys(error.fields).length) {
      const mapeados: Record<string, string> = {};
      for (const [campo, mensaje] of Object.entries(error.fields)) {
        const clave = campo.toLowerCase().includes('pass') ? 'password' : campo.toLowerCase().includes('email') ? 'email' : campo;
        mapeados[clave] = mensaje;
      }
      this.erroresBackend.set(mapeados);
      if (Object.keys(mapeados).length === Object.keys(error.fields).length && !this.mensaje()) {
        this.mensaje.set('Revisá los campos marcados e intentá nuevamente.');
      }
      return;
    }
    if (error.code === 'EMAIL_NOT_VERIFIED') {
      if (!error.verificationToken) {
        this.mensaje.set('No pudimos continuar la verificación. Volvé a intentar.');
        return;
      }
      this.pendiente.guardarEmail(this.loginModel().email, error.verificationToken, error.verificationExpiresIn ?? 900);
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
