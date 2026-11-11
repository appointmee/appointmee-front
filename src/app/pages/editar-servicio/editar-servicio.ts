import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ServicioPayload } from '../../models/servicio';
import { servicioService } from '../../services/servicio-service';

@Component({
  selector: 'app-editar-servicio',
  imports: [FormsModule],
  templateUrl: './editar-servicio.html',
  styleUrl: './editar-servicio.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditarServicio {
  private readonly api = inject(servicioService);

  servicioId: number | null = null;
  sucursalId: number | null = null;
  nombre = '';
  descripcion = '';
  duracion = 30;
  precio: number | null = null;
  fotoPerfil: string | null = null;

  protected readonly guardando = signal(false);
  protected readonly cargando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly exito = signal<string | null>(null);

  protected cargar(): void {
    if (!this.servicioId) return;
    this.cargando.set(true);
    this.api.obtenerPorId(this.servicioId).subscribe({
      next: (s) => {
        this.sucursalId = s.nombreSucursal ? this.sucursalId : this.sucursalId;
        this.nombre = s.nombre;
        this.descripcion = s.descripcion ?? '';
        this.duracion = s.duracion;
        this.precio = typeof s.precio === 'string' ? Number(s.precio) : s.precio;
        this.fotoPerfil = s.fotoPerfil;
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
        this.error.set('No se pudo cargar el servicio.');
      },
    });
  }

  protected guardar(): void {
    if (!this.servicioId || !this.sucursalId || !this.nombre.trim()) {
      this.error.set('Completá los campos obligatorios.');
      return;
    }
    this.guardando.set(true);
    this.error.set(null);
    const payload: ServicioPayload = {
      sucursalId: this.sucursalId,
      nombre: this.nombre.trim(),
      descripcion: this.descripcion.trim() || null,
      duracion: this.duracion,
      precio: this.precio,
      fotoPerfil: this.fotoPerfil,
    };
    this.api.actualizar(this.servicioId, payload).subscribe({
      next: () => {
        this.guardando.set(false);
        this.exito.set('Servicio actualizado correctamente.');
      },
      error: (_e: HttpErrorResponse) => {
        this.guardando.set(false);
        this.error.set('No se pudo actualizar el servicio.');
      },
    });
  }
}
