import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { SucursalPayload } from '../../models/sucursal';
import { sucursalService } from '../../services/sucursal-service';

@Component({
  selector: 'app-editar-sucursal',
  imports: [FormsModule],
  templateUrl: './editar-sucursal.html',
  styleUrl: './editar-sucursal.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditarSucursal {
  private readonly api = inject(sucursalService);

  sucursalId: number | null = null;
  nombre = '';
  direccion = '';
  categoria = '';

  protected readonly guardando = signal(false);
  protected readonly cargando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly exito = signal<string | null>(null);
  protected readonly erroresCampos = signal<Record<string,string>>({});

  protected cargar(): void {
    if (!this.sucursalId) return;
    this.cargando.set(true);
    this.api.obtenerPorId(this.sucursalId, true).subscribe({
      next: (s) => {
        this.nombre = s.nombre ?? '';
        this.direccion = s.direccion ?? '';
        this.categoria = s.categoria ?? '';
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
        this.error.set('No se pudo cargar la sucursal.');
      },
    });
  }

  protected guardar(): void {
    const errores: Record<string,string> = {};
    if (!this.nombre.trim()) errores['nombre']='El nombre es obligatorio.';
    this.erroresCampos.set(errores);
    if (Object.keys(errores).length) { this.error.set('Revisá los campos marcados.'); return; }
    if (!this.sucursalId || !this.nombre.trim()) {
      this.error.set('Completá los campos obligatorios.');
      return;
    }
    this.guardando.set(true);
    this.error.set(null);
    const payload: SucursalPayload = {
      nombre: this.nombre.trim(),
      direccion: this.direccion.trim(),
      categoria: this.categoria.trim(),
    } as SucursalPayload;
    this.api.actualizar(this.sucursalId, payload).subscribe({
      next: () => {
        this.guardando.set(false);
        this.exito.set('Sucursal actualizada correctamente.');
      },
      error: (_e: HttpErrorResponse) => {
        this.guardando.set(false);
        this.error.set('No se pudo actualizar la sucursal.');
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
