import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, Injector, afterNextRender, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, map, of, switchMap, throwError, timer } from 'rxjs';
import { authService } from '../../services/auth-service';
import { usuarioService } from '../../services/usuario-service';
import { inicialesDeTexto } from '../../models/solicitud-empleado';
import { UsuarioPerfilDTO } from '../../models/usuario';
import { DsButtonComponent } from '../../shared/ui/button/button.component';
import { DsInputComponent } from '../../shared/ui/input/input.component';
import { fotoPerfilDe } from '../../shared/foto-perfil';

import { DsModalComponent } from '../../shared/ui/misc/misc.component';

const nombreValido = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ ]{3,60}$/;
const correoValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const codigoValido = /^[0-9]{6}$/;

@Component({
  selector: 'app-editar-perfil',
  imports: [NgTemplateOutlet, FormsModule, DsButtonComponent, DsInputComponent, DsModalComponent],
  templateUrl: './editar-perfil.html',
  styleUrl: './editar-perfil.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditarPerfil {
  private readonly usuarios = inject(usuarioService);
  private readonly auth = inject(authService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  protected readonly camposPersonales = [
    { campo: 'nombre', etiqueta: 'Nombre', autocompletar: 'given-name' },
    { campo: 'apellido', etiqueta: 'Apellido', autocompletar: 'family-name' },
  ] as const;
  protected readonly editando = signal({ nombre: false, apellido: false });
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly perfil = signal<UsuarioPerfilDTO | null>(null);
  protected readonly ocupado = signal(false);
  protected readonly fotoFallida = signal(false);
  protected readonly arrastrandoFoto = signal(false);
  protected readonly aviso = signal('');
  protected readonly modalCorreo = signal(false);
  protected readonly errores = signal<Record<string, string>>({});
  protected readonly erroresDeDatos = computed(() => [
    { campo: 'nombre', etiqueta: 'Nombre', mensaje: this.errores()['nombre'] },
    { campo: 'apellido', etiqueta: 'Apellido', mensaje: this.errores()['apellido'] },
  ].filter((error) => error.mensaje));
  protected readonly iniciales = computed(() =>
    inicialesDeTexto([this.perfil()?.nombre, this.perfil()?.apellido].filter(Boolean).join(' ')),
  );

  protected readonly fotoPerfil = computed(() => {
    const foto = fotoPerfilDe(this.perfil());
    return foto && !this.fotoFallida() ? foto : null;
  });
  protected nombre = '';
  protected apellido = '';
  protected email = '';
  protected readonly confirmarEdicionCorreo = signal(false);
  protected readonly digitos = [0, 1, 2, 3, 4, 5];
  protected readonly codigo = signal<string[]>(Array<string>(6).fill(''));
  private readonly enviadoEn = signal(0);
  private readonly ahora = signal(Date.now());
  protected readonly esperaReenvio = computed(() =>
    Math.max(0, Math.ceil((this.enviadoEn() + 60_000 - this.ahora()) / 1000)),
  );
  protected readonly vigenciaCodigo = computed(() =>
    Math.max(0, Math.ceil((this.enviadoEn() + 300_000 - this.ahora()) / 1000)),
  );
  protected readonly tiempoCodigo = computed(() => {
    const segundos = this.vigenciaCodigo();
    return Math.floor(segundos / 60) + ':' + String(segundos % 60).padStart(2, '0');
  });
  protected pendiente = '';
  protected cambiarFoto = false;

  constructor() {
    this.cargar();
    timer(1000, 1000).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.ahora.set(Date.now()));
  }

  protected cargar(): void {
    const id = this.auth.perfil()?.id;
    if (!id) return;
    this.operar(this.usuarios.obtenerPerfil(id), '', (perfil) => {
      this.perfil.set(perfil);
      this.nombre = perfil.nombre ?? '';
      this.apellido = perfil.apellido ?? '';
    });
  }

  protected habilitarDato(campo: 'nombre' | 'apellido'): void {
    this.editando.update((actual) => ({ ...actual, [campo]: true }));
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLInputElement>(
      `#perfil-${campo}`,
    )?.focus(), { injector: this.injector });
  }

  protected actualizarDato(campo: 'nombre' | 'apellido', valor: string): void {
    this[campo] = valor;
    this.corregir(campo, valor);
  }

  protected hayCambios(): boolean {
    const perfil = this.perfil();
    return !!perfil && (this.nombre.trim() !== (perfil.nombre ?? '').trim()
      || this.apellido.trim() !== (perfil.apellido ?? '').trim());
  }

  protected guardar(): void {
    if (!this.hayCambios()) return;
    const perfil = this.perfil();
    if (!perfil || this.ocupado()) return;
    const datos = { nombre: this.nombre.trim(), apellido: this.apellido.trim() };
    const errores: Record<string, string> = {};
    for (const campo of ['nombre', 'apellido'] as const) {
      if (!nombreValido.test(datos[campo])) {
        errores[campo] = 'Ingresá entre 3 y 60 caracteres, con letras y espacios.';
      }
    }
    if (Object.keys(errores).length) {
      this.aviso.set('');
      this.mostrarErrores(errores);
      return;
    }
    this.operar(this.usuarios.modificarPerfil(perfil.id, datos), 'Cambios guardados.', () => {
      this.perfil.set({ ...perfil, ...datos });
      this.nombre = datos.nombre;
      this.apellido = datos.apellido;
      this.editando.set({ nombre: false, apellido: false });
    });
  }

  protected arrastrarFoto(event: DragEvent): void {
    event.preventDefault();
    if (!this.ocupado() && event.dataTransfer?.types.includes('Files')) {
      event.dataTransfer.dropEffect = 'copy';
      this.arrastrandoFoto.set(true);
    }
  }

  protected salirDeSubida(event: DragEvent): void {
    const zona = event.currentTarget as HTMLElement;
    if (!(event.relatedTarget instanceof Node) || !zona.contains(event.relatedTarget)) {
      this.arrastrandoFoto.set(false);
    }
  }

  protected soltar(event: DragEvent): void {
    this.arrastrandoFoto.set(false);
    event.preventDefault();
    const archivos = event.dataTransfer?.files;
    if (archivos?.length) this.subir(archivos[0]);
  }

  protected elegir(input: HTMLInputElement): void {
    const archivo = input.files?.[0];
    input.value = '';
    if (archivo) this.subir(archivo);
  }

  private subir(archivo: File): void {
    const perfil = this.perfil();
    if (!perfil || this.ocupado()) return;
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(archivo.type)
      || archivo.size === 0 || archivo.size > 5 * 1024 * 1024) {
      this.aviso.set('');
      this.errores.set({ fotoUrl: 'Elegí un archivo JPG, PNG, WEBP o GIF de hasta 5 MB.' });
      return;
    }
    const subida = this.usuarios.subirFotoPerfil(archivo).pipe(
      switchMap((foto) => this.usuarios.modificarPerfil(perfil.id, {
        fotoUrl: foto.url, fotoPublicId: foto.publicId,
      }).pipe(
        map(() => foto.url),
        catchError((error) => this.usuarios.descartarFotoSubida(foto).pipe(
          catchError(() => of(undefined)),
          switchMap(() => throwError(() => error)),
        )),
      )),
    );
    this.operar(subida, 'Foto de perfil actualizada.', (fotoPerfil) => {
      this.perfil.set({ ...perfil, fotoPerfil });
      this.fotoFallida.set(false);
      this.cambiarFoto = false;
      this.refrescarSesion();
    }, 'fotoUrl');
  }

  protected restablecer(): void {
    const perfil = this.perfil();
    if (!perfil || !fotoPerfilDe(perfil)) return;
    this.operar(this.usuarios.restablecerFotoPerfil(), 'Foto de perfil restablecida.', () => {
      const actual = this.perfil();
      if (!actual) return;
      this.perfil.set({ ...actual, fotoPerfil: null, urlFotoPerfil: null });
      this.fotoFallida.set(false);
      this.cambiarFoto = false;
      this.refrescarSesion();
    }, 'fotoUrl');
  }

  protected abrirCorreo(): void {
    this.confirmarEdicionCorreo.set(false);
    this.email = this.pendiente;
    this.codigo.set(Array<string>(6).fill(''));
    this.errores.update((errores) => ({ ...errores, email: '', codigo: '' }));
    this.aviso.set('');
    this.modalCorreo.set(true);
  }

  protected cerrarCorreo(): void {
    if (this.ocupado()) return;
    this.aviso.set('');
    this.modalCorreo.set(false);
  }

  protected escribirCodigo(indice: number, texto: string, input: HTMLInputElement): void {
    const numeros = texto.replace(/[^0-9]/g, '').slice(0, 6);
    const inicio = numeros.length === 6 ? 0 : indice;
    const casillas = [...this.codigo()];
    if (!numeros) casillas[indice] = '';
    Array.from(numeros).slice(0, 6 - inicio).forEach((numero, posicion) => {
      casillas[inicio + posicion] = numero;
    });
    input.value = casillas[indice];
    this.codigo.set(casillas);
    this.corregir('codigo', casillas.join(''));
    if (numeros) this.enfocarDigito(Math.min(5, inicio + numeros.length));
  }

  protected pegarCodigo(evento: ClipboardEvent, indice: number, input: HTMLInputElement): void {
    evento.preventDefault();
    this.escribirCodigo(indice, evento.clipboardData?.getData('text') ?? '', input);
  }

  protected teclaCodigo(evento: KeyboardEvent, indice: number): void {
    if (evento.key === 'Backspace' && !this.codigo()[indice] && indice > 0) {
      this.enfocarDigito(indice - 1);
    }
  }

  private enfocarDigito(indice: number): void {
    const input = this.host.nativeElement.querySelector<HTMLInputElement>(`#correo-codigo-${indice}`);
    input?.focus();
    input?.select();
  }

  protected enviarCodigo(): void {
    if (this.esperaReenvio() > 0) return;
    const email = this.email.trim().toLowerCase();
    if (!this.validarEmail(email)) {
      this.aviso.set('');
      this.mostrarErrores({ email: 'Ingresá un correo válido.' });
      return;
    }
    this.operar(this.usuarios.solicitarCambioEmail(email), 'Código enviado al correo nuevo.', () => {
      this.pendiente = email;
      const ahora = Date.now();
      this.ahora.set(ahora);
      this.enviadoEn.set(ahora);
      afterNextRender(() => this.enfocarDigito(0), { injector: this.injector });
      this.codigo.set(Array<string>(6).fill(''));
    }, 'email');
  }

  protected confirmarEmail(): void {
    if (!this.pendiente || this.vigenciaCodigo() === 0) return;
    const codigo = this.codigo().join('');
    if (!codigoValido.test(codigo)) {
      this.aviso.set('');
      this.mostrarErrores({ codigo: 'Ingresá los 6 dígitos del código.' });
      return;
    }
    this.operar(this.usuarios.confirmarCambioEmail(this.pendiente, codigo),
      'Correo actualizado.', () => {
        this.auth.limpiarSesion();
        void this.router.navigate(['/login'], { state: { emailDesdeAjustes: true } });
      }, 'codigo');
  }

  private refrescarSesion(): void {
    this.auth.validarToken().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ error: () => undefined });
  }

  protected corregir(campo: 'nombre' | 'apellido' | 'email' | 'codigo', valor: string): void {
    const limpio = valor.trim();
    const valido = campo === 'email' ? this.validarEmail(limpio)
      : campo === 'codigo' ? codigoValido.test(limpio) : nombreValido.test(limpio);
    if (valido && this.errores()[campo]) {
      this.errores.update((errores) => ({ ...errores, [campo]: '' }));
    }
  }

  private validarEmail(valor: string): boolean {
    return valor.length >= 8 && valor.length <= 150 && correoValido.test(valor);
  }

  private mostrarErrores(errores: Record<string, string>): void {
    this.errores.set(errores);
    this.editando.update((actual) => ({
      nombre: actual.nombre || !!errores['nombre'],
      apellido: actual.apellido || !!errores['apellido'],
    }));
    const campo = ['nombre', 'apellido', 'email', 'codigo'].find((nombre) => errores[nombre]);
    if (campo === 'codigo') {
      afterNextRender(() => this.enfocarDigito(0), { injector: this.injector });
    } else if (campo) {
      afterNextRender(() => this.host.nativeElement.querySelector<HTMLInputElement>(
        `input[name="${campo}"]`,
      )?.focus(), { injector: this.injector });
    }
  }

  private operar<T>(peticion: Observable<T>, mensaje: string,
    completar: (resultado: T) => void, campo = 'general'): void {
    if (this.ocupado()) return;
    this.ocupado.set(true);
    this.aviso.set('');
    this.errores.set({});
    peticion.pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.ocupado.set(false))).subscribe({
      next: (resultado) => {
        completar(resultado);
        this.aviso.set(mensaje);
      },
      error: (respuesta: HttpErrorResponse) => {
        let error = respuesta.error;
        if (typeof error === 'string' && respuesta.headers.get('Content-Type')?.includes('application/json')) {
          try {
            error = JSON.parse(error);
          } catch {
            // Una respuesta en texto se muestra como mensaje del formulario.
          }
        }
        if (error && typeof error === 'object' && respuesta.status === 400 && !error.message) {
          this.mostrarErrores(error);
          return;
        }
        const texto = typeof error === 'string' ? error : error?.message;
        const destino = campo === 'codigo' && respuesta.status === 409 ? 'email' : campo;
        this.mostrarErrores({ [destino]: texto || 'No pudimos completar la solicitud. Intentá de nuevo.' });
      },
    });
  }
}
