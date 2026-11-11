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
  protected readonly erroresCampos = signal<Record<string,string>>({});

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
    const errores: Record<string,string> = {};
    if (!this.sucursalId) errores['sucursalId']='La sucursal es obligatoria.';
    if (!this.nombre.trim()) errores['nombre']='El nombre es obligatorio.';
    if (!this.duracion || this.duracion <= 0) errores['duracion']='La duración debe ser mayor a 0.';
    this.erroresCampos.set(errores);
    if (Object.keys(errores).length) { this.error.set('Revisá los campos marcados.'); return; }
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

  protected tieneErrores(): boolean { return Object.keys(this.erroresCampos()).length > 0; }
  protected listaErrores(): [string,string][] { return Object.entries(this.erroresCampos()); }
  protected errorDe(campo: string): string | null { return this.erroresCampos()[campo] ?? null; }

  protected descartar(): void {
    if (window.confirm('¿Descartar los cambios?')) { this.cargar(); }
  }
}
