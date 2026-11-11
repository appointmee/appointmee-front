import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal, ViewChild, ElementRef } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { Router } from '@angular/router';

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
  private readonly router = inject(Router);

  sucursalId: number | null = null;
  nombre = '';
  descripcion = '';
  duracion = 30;
  precio: number | null = null;
  fotoPerfil: string | null = null;

  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly exito = signal<string | null>(null);
  protected readonly erroresCampos = signal<Record<string, string>>({});

  @ViewChild('primerInvalido') primerInvalido?: ElementRef<HTMLInputElement>;

  protected guardar(form?: NgForm): void {
    const errores: Record<string, string> = {};
    if (!this.sucursalId) errores['sucursalId'] = 'La sucursal es obligatoria.';
    if (!this.nombre.trim()) errores['nombre'] = 'El nombre es obligatorio.';
    if (!this.duracion || this.duracion <= 0) errores['duracion'] = 'La duración debe ser mayor a 0.';
    this.erroresCampos.set(errores);

    if (Object.keys(errores).length) {
      this.error.set('Revisá los campos marcados.');
      setTimeout(() => this.primerInvalido?.nativeElement?.focus(), 0);
      return;
    }

    this.guardando.set(true);
    this.error.set(null);
    const payload: ServicioPayload = {
      sucursalId: this.sucursalId!,
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
        setTimeout(() => this.router.navigate(['/mis-sucursales']), 800);
      },
      error: (err: HttpErrorResponse) => {
        this.guardando.set(false);
        const msg = err.error?.message || 'No se pudo crear el servicio. Intentá nuevamente.';
        this.error.set(msg);
      },
    });
  }

  protected tieneErrores(): boolean { return Object.keys(this.erroresCampos()).length > 0; }
  protected listaErrores(): [string, string][] { return Object.entries(this.erroresCampos()); }
  protected errorDe(campo: string): string | null {
    return this.erroresCampos()[campo] ?? null;
  }
}
