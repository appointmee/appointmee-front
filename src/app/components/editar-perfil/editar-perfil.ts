import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, map, of, switchMap, throwError } from 'rxjs';
import { authService } from '../../services/auth-service';
import { usuarioService } from '../../services/usuario-service';
import { inicialesDeTexto } from '../../models/solicitud-empleado';
import { UsuarioPerfilDTO } from '../../models/usuario';
import { DsButtonComponent } from '../../shared/ui/button/button.component';
import { DsInputComponent } from '../../shared/ui/input/input.component';

const nombreValido = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ ]{3,60}$/;
const correoValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const codigoValido = /^[0-9]{6}$/;

@Component({
  selector: 'app-editar-perfil',
  imports: [FormsModule, DsButtonComponent, DsInputComponent],
  templateUrl: './editar-perfil.html',
  styleUrl: './editar-perfil.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditarPerfil {
  private readonly usuarios = inject(usuarioService);
  private readonly auth = inject(authService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly perfil = signal<UsuarioPerfilDTO | null>(null);
  protected readonly ocupado = signal(false);
  protected readonly fotoFallida = signal(false);
  protected readonly aviso = signal('');
  protected readonly errores = signal<Record<string, string>>({});
  protected readonly erroresDeDatos = computed(() => [
    { campo: 'nombre', etiqueta: 'Nombre', mensaje: this.errores()['nombre'] },
    { campo: 'apellido', etiqueta: 'Apellido', mensaje: this.errores()['apellido'] },
  ].filter((error) => error.mensaje));
  protected readonly iniciales = computed(() =>
    inicialesDeTexto([this.perfil()?.nombre, this.perfil()?.apellido].filter(Boolean).join(' ')),
  );
  protected nombre = '';
  protected apellido = '';
  protected email = '';
  protected codigo = '';
  protected pendiente = '';
  protected cambiarFoto = false;

  constructor() {
    this.cargar();
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

  protected guardar(): void {
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
    });
  }

  protected soltar(event: DragEvent): void {
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
    if (!perfil?.fotoPerfil) return;
    this.operar(this.usuarios.restablecerFotoPerfil(), 'Foto de perfil restablecida.', () => {
      this.perfil.set({ ...perfil, fotoPerfil: null });
      this.fotoFallida.set(false);
      this.cambiarFoto = false;
      this.refrescarSesion();
    }, 'fotoUrl');
  }

  protected enviarCodigo(): void {
    const email = this.email.trim().toLowerCase();
    if (!this.validarEmail(email)) {
      this.aviso.set('');
      this.mostrarErrores({ email: 'Ingresá un correo válido.' });
      return;
    }
    this.operar(this.usuarios.solicitarCambioEmail(email), 'Código enviado al correo nuevo.', () => {
      this.pendiente = email;
      this.codigo = '';
    }, 'email');
  }

  protected confirmarEmail(): void {
    if (!this.pendiente) return;
    if (!codigoValido.test(this.codigo.trim())) {
      this.aviso.set('');
      this.mostrarErrores({ codigo: 'Ingresá los 6 dígitos del código.' });
      return;
    }
    this.operar(this.usuarios.confirmarCambioEmail(this.pendiente, this.codigo.trim()),
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
    const campo = ['nombre', 'apellido', 'email', 'codigo'].find((nombre) => errores[nombre]);
    if (campo) {
      queueMicrotask(() => this.host.nativeElement.querySelector<HTMLInputElement>(
        `input[name="${campo}"]`,
      )?.focus());
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
