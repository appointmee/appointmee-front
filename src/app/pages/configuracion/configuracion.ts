import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnInit, computed, effect, inject, signal, viewChildren } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { email, form, maxLength, pattern, required } from '@angular/forms/signals';
import { Router } from '@angular/router';
import { timer } from 'rxjs';

import { VerificacionEmailModel } from '../../models/auth';
import { ApiError } from '../../http/api-errors-service';
import { verificacionPendienteService } from '../../services/verificacion-pendiente-service';
import { authService } from '../../services/auth-service';

@Component({
  selector: 'app-configuracion',
  templateUrl: './configuracion.html',
  styleUrl: './configuracion.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Configuracion implements OnInit {

  auth = inject(authService);
  private router = inject(Router);
  private pendiente = inject(verificacionPendienteService);
  private destroyRef = inject(DestroyRef);
  private ultimoCodigoIntentado: string | null = null;
  private camposCodigo = viewChildren<ElementRef<HTMLInputElement>>('casillaCodigo');

  indicesCodigo = [0, 1, 2, 3, 4, 5];


  verificacionModel = signal<VerificacionEmailModel>({
    email: this.auth.perfil()?.email ?? this.pendiente.leer()?.email ?? '',
    codigo: '',
  });

  verificacionForm = form(this.verificacionModel, campos => {
    required(campos.email, { message: 'Ingresá el email de tu cuenta.' });
    email(campos.email, { message: 'Ingresá un email válido.' });

    required(campos.codigo, { message: 'Ingresá el código del correo.' });
    maxLength(campos.codigo, 6, { message: 'El código debe tener 6 dígitos.' });
    pattern(campos.codigo, /^[0-9]{6}$/, { message: 'El código debe tener 6 dígitos.' });
  });


  enviando = signal(false);
  codigoEnviado = signal(this.pendiente.leer()?.enviado ?? false);
  redirigiendo = signal(false);
  confirmando = signal(false);
  segundosReenvio = signal(this.pendiente.segundosParaReenvio());
  segundosVigencia = signal(this.pendiente.segundosDeVigencia());
  avisoVigencia = signal('');

  tiempoVigencia = computed(() => {
    const segundos = this.segundosVigencia();
    return Math.floor(segundos / 60) + ':' + String(segundos % 60).padStart(2, '0');
  });
  bloqueada = signal((this.pendiente.leer()?.intentos ?? 0) >= 5);
  reenvioSugerido = signal(false);
  verificada = signal(this.auth.autenticado());
  aviso = signal('');
  error = signal('');


  contextoValido = computed(() => this.verificacionForm.email().valid());

  emailEnmascarado = computed(() => {
    if (!this.contextoValido()) return '';

    const email = this.verificacionModel().email.trim();
    const arroba = email.lastIndexOf('@');
    const nombre = email.slice(0, arroba);
    const visibles = Math.min(2, Math.max(0, nombre.length - 1));

    return nombre.slice(0, visibles) + '***' + email.slice(arroba);
  });


  puedeVerificar = computed(() => /^[0-9]{6}$/.test(this.verificacionModel().codigo)
    && this.verificacionForm.email().valid()
    && this.segundosVigencia() > 0
    && !this.enviando() && !this.confirmando() && !this.bloqueada() && !this.verificada());


  constructor() {
    effect(onCleanup => {
      const codigo = this.verificacionModel().codigo;

      if (!/^[0-9]{6}$/.test(codigo)) {
        this.ultimoCodigoIntentado = null;
        return;
      }

      if (!this.puedeVerificar() || codigo === this.ultimoCodigoIntentado) return;

      const espera = setTimeout(() => {
        if (this.puedeVerificar() && this.verificacionModel().codigo === codigo) {
          this.confirmarCodigo(new Event('submit'));
        }
      }, 2000);

      onCleanup(() => clearTimeout(espera));
    });

    timer(1000, 1000).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.segundosReenvio.set(this.pendiente.segundosParaReenvio());
      this.actualizarVigencia();
    });
  }


  ngOnInit(): void {
    this.actualizarVigencia(true);
    if (!this.verificada() && this.contextoValido() && !this.codigoEnviado() && !this.bloqueada() && this.segundosReenvio() === 0) {
      this.enviarCodigo(false);
    }
  }


  irASucursales(): void {
    void this.router.navigate(['/sucursales']);
  }


  digito(indice: number): string {
    return this.verificacionModel().codigo[indice]?.replace(/[^0-9]/g, '') ?? '';
  }


  ingresarCodigo(event: Event, indice: number): void {
    if (this.enviando() || this.confirmando() || this.bloqueada()) return;

    const input = event.target as HTMLInputElement;
    const numeros = input.value.replace(/[^0-9]/g, '').slice(0, 6);

    if (numeros.length > 1) {
      this.distribuirCodigo(numeros, indice);
      return;
    }

    input.value = numeros;
    this.cambiarDigito(indice, numeros);
    if (numeros) this.enfocarCasilla(Math.min(indice + 1, 5));
  }


  pegarCodigo(event: ClipboardEvent, indice: number): void {
    event.preventDefault();
    if (this.enviando() || this.confirmando() || this.bloqueada()) return;

    const numeros = (event.clipboardData?.getData('text') ?? '').replace(/[^0-9]/g, '').slice(0, 6);
    if (numeros) this.distribuirCodigo(numeros, indice);
    // El envío automático espera dos segundos sin cambios; pegar no lo envía de inmediato.
  }


  teclaCodigo(event: KeyboardEvent, indice: number): void {
    if (this.enviando() || this.confirmando() || this.bloqueada()) return;

    if (event.key === 'Backspace') {
      event.preventDefault();
      const borrar = this.digito(indice) ? indice : Math.max(indice - 1, 0);
      this.cambiarDigito(borrar, '');
      this.enfocarCasilla(Math.max(indice - 1, 0));
    } else if (event.key === 'Delete') {
      event.preventDefault();
      this.cambiarDigito(indice, '');
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      this.enfocarCasilla(Math.max(0, Math.min(5, indice + (event.key === 'ArrowRight' ? 1 : -1))));
    } else if (event.key.length === 1 && !/[0-9]/.test(event.key) && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
    }
  }


  seleccionarCodigo(event: FocusEvent): void {
    (event.target as HTMLInputElement).select();
  }


  enfocarCasilla(indice: number): void {
    const campo = this.camposCodigo()[indice]?.nativeElement;
    campo?.focus();
    campo?.select();
  }


  private cambiarDigito(indice: number, digito: string): void {
    const casillas = this.verificacionModel().codigo.padEnd(6, ' ').split('');
    casillas[indice] = digito || ' ';
    this.verificacionModel.update(datos => ({ ...datos, codigo: casillas.join('').trimEnd() }));
  }


  private distribuirCodigo(numeros: string, indice: number): void {
    const inicio = numeros.length === 6 ? 0 : indice;
    const casillas = inicio === 0 ? Array<string>(6).fill(' ') : this.verificacionModel().codigo.padEnd(6, ' ').split('');

    for (let posicion = 0; posicion < numeros.length && inicio + posicion < 6; posicion++) {
      casillas[inicio + posicion] = numeros[posicion];
    }

    this.verificacionModel.update(datos => ({ ...datos, codigo: casillas.join('').trimEnd() }));

    // Actualizar antes de seleccionar permite corregir el último dígito tras pegar.
    this.camposCodigo().forEach((campo, posicion) => {
      campo.nativeElement.value = casillas[posicion].trim();
    });

    this.enfocarCasilla(Math.min(inicio + numeros.length, 5));
  }


  volverAlLogin(): void {
    this.pendiente.limpiar();
    this.verificacionModel.update(datos => ({ ...datos, codigo: '' }));
    void this.router.navigate(['/login']);
  }


  enviarCodigo(reenviar = true): void {
    if (this.enviando() || this.confirmando() || this.verificada() || this.segundosReenvio() > 0) return;

    this.normalizarEmail();
    this.verificacionForm.email().markAsTouched();

    if (this.verificacionForm.email().invalid()) {
      this.error.set('Volvé a iniciar sesión para revisar tu email.');
      return;
    }

    this.enviando.set(true);
    this.aviso.set('');
    this.error.set('');

    this.auth.solicitarVerificacion(this.verificacionModel().email, reenviar).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (estado) => {
        this.pendiente.aplicarEstado(estado);
        if (estado.verificada) {
          this.auth.completarVerificacion().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: () => this.finalizarVerificacion(),
            error: () => {
              this.enviando.set(false);
              this.verificada.set(true);
              this.aviso.set('Tu cuenta está verificada. Volvé a iniciar sesión para continuar.');
            },
          });
          return;
        }
        this.enviando.set(false);
        this.codigoEnviado.set(estado.enviado);
        this.actualizarVigencia(true);
        this.segundosReenvio.set(this.pendiente.segundosParaReenvio());
        this.bloqueada.set(estado.attemptsRemaining <= 0);
        this.aviso.set(estado.enviadoAhora
          ? 'Código enviado. Usá el último código recibido por email.'
          : estado.enviado ? 'Ya hay un código vigente. Usá el último correo recibido y revisá también el spam.'
          : 'Esperá el tiempo indicado para pedir un código nuevo.');

        if (estado.enviadoAhora) {
          this.reenvioSugerido.set(false);
          this.verificacionModel.update(datos => ({ ...datos, codigo: '' }));
          this.enfocarCasilla(0);
        }
      },

      error: (error: ApiError) => {
        this.enviando.set(false);
        if (error.status === 401) { this.volverAlLogin(); return; }
        this.error.set(error.status === 429
          ? 'Demasiados intentos. Esperá un momento antes de solicitar otro código.'
          : 'No pudimos enviar la solicitud. Revisá tu conexión e intentá nuevamente.');
      },
    });
  }


  confirmarCodigo(event: Event): void {
    event.preventDefault();
    if (this.confirmando() || this.enviando() || this.verificada() || this.bloqueada()) return;
    if (this.codigoEnviado() && this.segundosVigencia() === 0) {
      this.error.set('El código venció. Pedí uno nuevo.');
      this.reenvioSugerido.set(true);
      return;
    }

    this.normalizarEmail();
    this.verificacionModel.update(datos => ({ ...datos, codigo: datos.codigo.trim() }));
    this.verificacionForm().markAsTouched();

    if (this.verificacionForm().invalid()) {
      if (this.verificacionForm.email().invalid()) this.error.set('Volvé a iniciar sesión para revisar tu email.');
      else this.enfocarCasilla(0);
      return;
    }

    this.ultimoCodigoIntentado = this.verificacionModel().codigo;
    this.confirmando.set(true);
    this.aviso.set('');
    this.error.set('');

    const datos = this.verificacionModel();

    this.auth.verificarEmail(datos.email, datos.codigo).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: () => this.finalizarVerificacion(),

      error: (error: ApiError) => {
        this.confirmando.set(false);
        if (error.code === 'VERIFICATION_SESSION_FAILED') {
          this.verificada.set(true);
          this.aviso.set('Tu cuenta está verificada, pero no pudimos completar la sesión. Volvé a iniciar sesión.');
          return;
        }
        if (error.status === 400) {
          if (error.code === 'VERIFICATION_CODE_EXPIRED') {
            this.pendiente.marcarCodigoVencido();
            this.actualizarVigencia(true);
          }
          this.error.set('El código es incorrecto o venció');
          this.bloqueada.set(this.pendiente.registrarError(error.attemptsRemaining, error.retryAfterSeconds) >= 5);
          this.segundosReenvio.set(this.pendiente.segundosParaReenvio());
          this.reenvioSugerido.set(true);
          this.verificacionModel.update(datos => ({ ...datos, codigo: '' }));
          this.enfocarCasilla(0);
          return;
        }

        if (error.status === 401) { this.volverAlLogin(); return; }
        this.error.set(error.status === 429
          ? 'Demasiados intentos. Esperá un momento antes de reintentar.'
          : 'No pudimos verificar tu cuenta. Revisá tu conexión e intentá nuevamente.');
      },
    });
  }


  private finalizarVerificacion(): void {
    this.enviando.set(false);
    this.confirmando.set(false);
    this.verificada.set(true);
    this.pendiente.limpiar();
    this.verificacionModel.update(datos => ({ ...datos, codigo: '' }));
    this.aviso.set('Todo bien. Tu cuenta fue verificada correctamente.');
    this.redirigiendo.set(true);
    timer(2000).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.irASucursales());
  }


  private actualizarVigencia(anunciar = false): void {
    if (this.verificada()) return;

    const segundos = this.pendiente.segundosDeVigencia();
    const cambio = segundos !== this.segundosVigencia();
    this.segundosVigencia.set(segundos);

    if (!this.codigoEnviado()) return;
    if (segundos === 0) this.reenvioSugerido.set(true);

    // Anunciar al inicio y en hitos, sin interrumpir la escritura cada segundo.
    if (anunciar || (cambio && (segundos % 60 === 0 || segundos === 30 || segundos === 10))) {
      this.avisoVigencia.set(segundos === 0
        ? 'El código venció. Podés solicitar uno nuevo.'
        : `El código vence en ${Math.floor(segundos / 60)} minutos y ${segundos % 60} segundos.`);
    }
  }


  private normalizarEmail(): void {
    this.verificacionModel.update(datos => ({ ...datos, email: datos.email.trim().toLowerCase() }));
  }
}
