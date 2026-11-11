import { DsButtonComponent } from '../../shared/ui/button/button.component';
import { DsInputComponent } from '../../shared/ui/input/input.component';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormField, form, max, maxLength, min, minLength, pattern, required } from '@angular/forms/signals';
import { ActivatedRoute, Router } from '@angular/router';

import { ServicioDTO, ServicioPayload } from '../../models/servicio';
import { servicioService } from '../../services/servicio-service';

interface EditarServicioModel {
  nombre: string;
  descripcion: string;
  duracion: number | null;
  precio: number | null;
  fotoPerfil: string;
}

@Component({
  selector: 'app-editar-servicio',
  imports: [DsButtonComponent, DsInputComponent, FormField],
  templateUrl: './editar-servicio.html',
  styleUrl: './editar-servicio.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditarServicioPage {
  private readonly api = inject(servicioService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly servicioId = this.parseId(this.route.snapshot.paramMap.get('servicioId'));
  readonly sucursalId = this.parseId(this.route.snapshot.paramMap.get('sucursalId'));

  cargando = signal(false);
  cargandoDatos = signal(true);
  error = signal<string | null>(null);
  exito = signal<string | null>(null);
  confirmarDescarte = signal(false);
  original = signal<EditarServicioModel | null>(null);

  model = signal<EditarServicioModel>({
    nombre: '',
    descripcion: '',
    duracion: null,
    precio: null,
    fotoPerfil: '',
  });

  formulario = form(this.model, (campos) => {
    required(campos.nombre, { message: 'Ingresá el nombre del servicio.' });
    minLength(campos.nombre, 4, { message: 'Usá al menos 4 caracteres.' });
    maxLength(campos.nombre, 60, { message: 'Usá como máximo 60 caracteres.' });
    pattern(campos.nombre, /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s,-]+$/, { message: 'El nombre solo puede tener letras y espacios.' });
    minLength(campos.descripcion, 10, { message: 'La descripción debe tener al menos 10 caracteres.' });
    maxLength(campos.descripcion, 500, { message: 'La descripción no puede superar 500 caracteres.' });
    required(campos.duracion, { message: 'Ingresá la duración en minutos.' });
    min(campos.duracion, 30, { message: 'La duración mínima es 30 minutos.' });
    max(campos.duracion, 360, { message: 'La duración máxima es 360 minutos.' });
    min(campos.precio, 0.01, { message: 'El precio mínimo es 0,01.' });
    max(campos.precio, 999999.99, { message: 'El precio máximo es 999999,99.' });
    pattern(campos.fotoPerfil, /^(?:https?:\/\/\S+)?$/, { message: 'Ingresá una URL válida.' });
  });

  constructor() {
    if (this.servicioId === null) {
      this.cargandoDatos.set(false);
      this.error.set('No se pudo identificar el servicio.');
      return;
    }
    this.api
      .obtenerPorId(this.servicioId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (servicio: ServicioDTO) => {
          const datos: EditarServicioModel = {
            nombre: servicio.nombre ?? '',
            descripcion: servicio.descripcion ?? '',
            duracion: servicio.duracion ?? null,
            precio: typeof servicio.precio === 'string' ? Number(servicio.precio) || null : servicio.precio,
            fotoPerfil: servicio.fotoPerfil ?? '',
          };
          this.model.set(datos);
          this.original.set(datos);
          this.cargandoDatos.set(false);
        },
        error: () => {
          this.cargandoDatos.set(false);
          this.error.set('No pudimos cargar el servicio. Intentá de nuevo.');
        },
      });
  }

  hayCambios(): boolean {
    const original = this.original();
    if (!original) return false;
    return JSON.stringify(original) !== JSON.stringify(this.model());
  }

  onSubmit(event: Event): void {
    event.preventDefault();
    if (this.cargando() || this.servicioId === null) return;
    this.formulario().markAsTouched();
    if (this.formulario().invalid()) {
      const primerCampoInvalido = [
        this.formulario.nombre,
        this.formulario.duracion,
      ].find(campo => campo().invalid());
      primerCampoInvalido?.().focusBoundControl();
      return;
    }

    this.cargando.set(true);
    this.error.set(null);
    this.exito.set(null);

    const datos: ServicioPayload = {
      sucursalId: this.sucursalId ?? 0,
      nombre: this.model().nombre.trim(),
      descripcion: this.model().descripcion.trim() || null,
      duracion: this.model().duracion ?? 0,
      precio: this.model().precio,
      fotoPerfil: this.model().fotoPerfil.trim() || null,
    };

    this.api
      .actualizar(this.servicioId, datos)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.cargando.set(false);
          this.exito.set('Servicio actualizado correctamente.');
          this.original.set(this.model());
        },
        error: () => {
          this.cargando.set(false);
          this.error.set('No pudimos actualizar el servicio. Revisá los datos e intentá nuevamente.');
        },
      });
  }

  cancelar(): void {
    if (this.hayCambios()) {
      this.confirmarDescarte.set(true);
      return;
    }
    this.volver();
  }

  confirmarDescartar(): void {
    this.confirmarDescarte.set(false);
    this.volver();
  }

  volver(): void {
    void this.router.navigateByUrl('/mis-sucursales');
  }

  private parseId(value: string | null): number | null {
    if (!value?.trim()) return null;
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
  }
}
