import { DsButtonComponent } from '../../shared/ui/button/button.component';
import { DsInputComponent } from '../../shared/ui/input/input.component';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormField, form, min, minLength, required } from '@angular/forms/signals';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

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
    minLength(campos.nombre, 2, { message: 'El nombre es muy corto.' });
    required(campos.duracion, { message: 'Ingresá la duración en minutos.' });
    min(campos.duracion, 1, { message: 'La duración debe ser mayor a 0.' });
  });

  onSubmit(event: Event): void {
    event.preventDefault();
    if (this.cargando()) return;
    this.formulario().markAsTouched();
    if (this.formulario().invalid()) {
      const primerCampoInvalido = [
        this.formulario.nombre,
        this.formulario.duracion,
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
      descripcion: this.model().descripcion.trim() || null,
      duracion: this.model().duracion ?? 30,
      precio: this.model().precio,
      fotoPerfil: this.model().fotoPerfil.trim() || null,
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
        error: (err: HttpErrorResponse) => {
          this.cargando.set(false);
          const msg = (err.error as { message?: string } | null)?.message || 'No pudimos crear el servicio. Intentá de nuevo.';
          this.error.set(msg);
        },
      });
  }

  private parseId(value: string | null): number | null {
    if (!value?.trim()) return null;
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
  }
}
