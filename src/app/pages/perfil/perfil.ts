import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormField, email, form, maxLength, minLength, pattern, required } from '@angular/forms/signals';

import { DsButtonComponent } from '../../shared/ui/button/button.component';
import { DsInputComponent } from '../../shared/ui/input/input.component';
import { UsuarioModificarPayload, UsuarioResponseDTO } from '../../models/usuario';
import { authService } from '../../services/auth-service';
import { usuarioService } from '../../services/usuario-service';

interface PerfilModel {
  nombre: string;
  apellido: string;
  email: string;
  fotoUrl: string;
}

@Component({
  selector: 'app-perfil',
  imports: [DsButtonComponent, DsInputComponent, FormField],
  templateUrl: './perfil.html',
  styleUrl: './perfil.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PerfilPage {
  private readonly api = inject(usuarioService);
  private readonly auth = inject(authService);
  private readonly destroyRef = inject(DestroyRef);

  readonly userId = this.auth.perfil()?.id ?? null;
  readonly model = signal<PerfilModel>({ nombre: '', apellido: '', email: '', fotoUrl: '' });
  readonly cargandoDatos = signal(true);
  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);
  readonly exito = signal<string | null>(null);
  readonly fotoRota = signal(false);
  readonly iniciales = computed(() => `${this.model().nombre[0] ?? ''}${this.model().apellido[0] ?? ''}`.toUpperCase() || 'AM');

  readonly formulario = form(this.model, campos => {
    required(campos.nombre, { message: 'Ingresá tu nombre.' });
    minLength(campos.nombre, 3, { message: 'El nombre debe tener al menos 3 caracteres.' });
    maxLength(campos.nombre, 60, { message: 'El nombre no puede superar 60 caracteres.' });
    pattern(campos.nombre, /^[a-zA-ZáéíóúÁÉÍÓÚñÑ ]+$/, { message: 'El nombre solo puede contener letras y espacios.' });
    required(campos.apellido, { message: 'Ingresá tu apellido.' });
    minLength(campos.apellido, 3, { message: 'El apellido debe tener al menos 3 caracteres.' });
    maxLength(campos.apellido, 60, { message: 'El apellido no puede superar 60 caracteres.' });
    pattern(campos.apellido, /^[a-zA-ZáéíóúÁÉÍÓÚñÑ ]+$/, { message: 'El apellido solo puede contener letras y espacios.' });
    required(campos.email, { message: 'Ingresá tu email.' });
    email(campos.email, { message: 'Ingresá un email válido.' });
    maxLength(campos.email, 150, { message: 'El email no puede superar 150 caracteres.' });
    pattern(campos.fotoUrl, /^(?:https?:\/\/\S+)?$/, { message: 'Ingresá una URL de imagen válida.' });
  });

  constructor() {
    this.cargar();
  }

  cargar(): void {
    if (this.userId === null) {
      this.cargandoDatos.set(false);
      this.error.set('No pudimos identificar tu cuenta. Iniciá sesión nuevamente.');
      return;
    }
    this.cargandoDatos.set(true);
    this.error.set(null);
    this.api.obtenerPorId(this.userId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (perfil: UsuarioResponseDTO) => {
        this.model.set({
          nombre: perfil.nombre ?? '', apellido: perfil.apellido ?? '',
          email: perfil.email ?? '', fotoUrl: perfil.urlFotoPerfil ?? '',
        });
        this.fotoRota.set(false);
        this.cargandoDatos.set(false);
      },
      error: () => {
        this.cargandoDatos.set(false);
        this.error.set('No pudimos cargar tu perfil. Revisá tu conexión e intentá nuevamente.');
      },
    });
  }

  onSubmit(event: Event): void {
    event.preventDefault();
    if (this.cargando() || this.userId === null) return;
    this.formulario().markAsTouched();
    if (this.formulario().invalid()) {
      const primero = [this.formulario.nombre, this.formulario.apellido,
        this.formulario.email, this.formulario.fotoUrl].find(campo => campo().invalid());
      primero?.().focusBoundControl();
      return;
    }

    const model = this.model();
    const payload: UsuarioModificarPayload = {
      nombre: model.nombre.trim(), apellido: model.apellido.trim(),
      email: model.email.trim().toLowerCase(), fotoUrl: model.fotoUrl.trim() || null,
    };
    this.cargando.set(true);
    this.error.set(null);
    this.exito.set(null);
    this.api.actualizar(this.userId, payload).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.cargando.set(false);
        this.exito.set('Tu perfil se actualizó correctamente.');
        this.auth.actualizarFotoPerfil(payload.fotoUrl);
      },
      error: () => {
        this.cargando.set(false);
        this.error.set('No pudimos guardar los cambios. Revisá los datos e intentá nuevamente.');
      },
    });
  }

  eliminarFoto(): void {
    if (this.cargando() || !this.model().fotoUrl) return;
    this.cargando.set(true);
    this.error.set(null);
    this.exito.set(null);
    this.api.eliminarFotoPerfil().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.model.update(model => ({ ...model, fotoUrl: '' }));
        this.auth.actualizarFotoPerfil(null);
        this.fotoRota.set(false);
        this.cargando.set(false);
        this.exito.set('Se eliminó tu foto. Se muestra el avatar predeterminado.');
      },
      error: () => {
        this.cargando.set(false);
        this.error.set('No pudimos eliminar la foto. Intentá nuevamente.');
      },
    });
  }
}
