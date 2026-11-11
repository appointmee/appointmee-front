import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ServicioPayload } from '../../models/servicio';
import { servicioService } from '../../services/servicio-service';

@Component({
  selector: 'app-crear-servicio',
  imports: [FormsModule],
  templateUrl: './crear-servicio.html',
  styleUrl: './crear-servicio.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CrearServicio {
  private readonly api = inject(servicioService);

  sucursalId: number | null = null;
  nombre = '';
  descripcion = '';
  duracion = 30;
  precio: number | null = null;
  fotoPerfil: string | null = null;

  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly exito = signal<string | null>(null);

  protected guardar(): void {
    if (!this.sucursalId || !this.nombre.trim()) {
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
    this.api.crear(payload).subscribe({
      next: () => {
        this.guardando.set(false);
        this.exito.set('Servicio creado correctamente.');
      },
      error: (_err: HttpErrorResponse) => {
        this.guardando.set(false);
        this.error.set('No se pudo crear el servicio. Intentá nuevamente.');
      },
    });
  }
}
