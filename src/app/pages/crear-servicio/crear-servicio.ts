import { DsButtonComponent } from '../../shared/ui/button/button.component';
import { DsInputComponent } from '../../shared/ui/input/input.component';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormField, form, max, maxLength, min, minLength, pattern, required } from '@angular/forms/signals';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { ServicioPayload } from '../../models/servicio';
import { servicioService } from '../../services/servicio-service';

interface CrearServicioModel {
  nombre: string;
  descripcion: string;
  duracion: number | null;
  precio: number | null;
  fotoPerfil: string;
}

@Component({
  selector: 'app-crear-servicio',
  imports: [DsButtonComponent, DsInputComponent, FormField, RouterLink],
  templateUrl: './crear-servicio.html',
  styleUrl: './crear-servicio.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CrearServicioPage {
  private readonly api = inject(servicioService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly sucursalId = this.parseId(this.route.snapshot.paramMap.get('sucursalId'));

  cargando = signal(false);
  error = signal<string | null>(null);
  exito = signal<string | null>(null);

  model = signal<CrearServicioModel>({
    nombre: '',
    descripcion: '',
    duracion: 30,
    precio: null,
    fotoPerfil: '',
  });

  formulario = form(this.model, (campos) => {
    required(campos.nombre, { message: 'Ingresá el nombre del servicio.' });
    minLength(campos.nombre, 4, { message: 'Usá al menos 4 caracteres.' });
    maxLength(campos.nombre, 60, { message: 'Usá como máximo 60 caracteres.' });
    pattern(campos.nombre, /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s,-]+$/, { message: 'El nombre solo puede tener letras y espacios.' });
    required(campos.descripcion, { message: 'Ingresá una descripción.' });
    minLength(campos.descripcion, 10, { message: 'La descripción debe tener al menos 10 caracteres.' });
    maxLength(campos.descripcion, 500, { message: 'La descripción no puede superar 500 caracteres.' });
    required(campos.duracion, { message: 'Ingresá la duración en minutos.' });
    min(campos.duracion, 30, { message: 'La duración mínima es 30 minutos.' });
    max(campos.duracion, 360, { message: 'La duración máxima es 360 minutos.' });
    required(campos.precio, { message: 'Ingresá el precio del servicio.' });
    min(campos.precio, 0.01, { message: 'El precio mínimo es 0,01.' });
    max(campos.precio, 999999.99, { message: 'El precio máximo es 999999,99.' });
    required(campos.fotoPerfil, { message: 'Ingresá la URL de la foto del servicio.' });
    pattern(campos.fotoPerfil, /^https?:\/\/\S+$/, { message: 'Ingresá una URL válida.' });
  });

  onSubmit(event: Event): void {
    event.preventDefault();
    if (this.cargando()) return;
    this.formulario().markAsTouched();
    if (this.formulario().invalid()) {
      const primerCampoInvalido = [
        this.formulario.nombre,
        this.formulario.descripcion,
        this.formulario.duracion,
        this.formulario.precio,
        this.formulario.fotoPerfil,
      ].find(campo => campo().invalid());
      primerCampoInvalido?.().focusBoundControl();
      return;
    }
    if (this.sucursalId === null) {
      this.error.set('No se pudo identificar la sucursal.');
      return;
    }

    this.cargando.set(true);
    this.error.set(null);
    this.exito.set(null);

    const datos: ServicioPayload = {
      sucursalId: this.sucursalId,
      nombre: this.model().nombre.trim(),
      descripcion: this.model().descripcion.trim(),
      duracion: this.model().duracion ?? 0,
      precio: this.model().precio,
      fotoPerfil: this.model().fotoPerfil.trim(),
    };

    this.api
      .crear(datos)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.cargando.set(false);
          this.exito.set('Servicio creado correctamente.');
          void this.router.navigateByUrl('/mis-sucursales');
        },
        error: () => {
          this.cargando.set(false);
          this.error.set('No pudimos crear el servicio. Revisá los datos e intentá nuevamente.');
        },
      });
  }

  private parseId(value: string | null): number | null {
    if (!value?.trim()) return null;
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
  }
}
