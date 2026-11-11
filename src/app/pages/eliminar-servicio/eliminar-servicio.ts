import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ServicioDTO } from '../../models/servicio';
import { servicioService } from '../../services/servicio-service';
import { authService } from '../../services/auth-service';

@Component({
  selector: 'app-eliminar-servicio',
  imports: [FormsModule],
  templateUrl: './eliminar-servicio.html',
  styleUrl: './eliminar-servicio.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EliminarServicio {
  private readonly api = inject(servicioService);
  protected readonly auth = inject(authService);

  sucursalId: number | null = null;
  servicioId: number | null = null;
  protected readonly servicios = signal<readonly ServicioDTO[]>([]);
  protected readonly eliminando = signal(false);
  protected readonly cargando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly exito = signal<string | null>(null);

  protected cargar(): void {
    if (!this.sucursalId) return;
    this.cargando.set(true);
    this.api.listarPorSucursal(this.sucursalId).subscribe({
      next: (s) => { this.servicios.set(s); this.cargando.set(false); },
      error: () => { this.cargando.set(false); this.error.set('No se pudieron cargar los servicios.'); },
    });
  }

  protected eliminar(id?: number): void {
    const target = id ?? this.servicioId;
    if (!target) { this.error.set('Seleccioná un servicio.'); return; }
    if (!this.auth.tieneAlgunRol('EMPLEADOR','ADMINISTRADOR')) { this.error.set('Sin permisos.'); return; }
    if (!window.confirm('¿Confirmás la eliminación?')) return;
    this.eliminando.set(true);
    this.error.set(null);
    this.api.eliminar(target).subscribe({
      next: () => {
        this.eliminando.set(false);
        this.exito.set('Servicio eliminado.');
        this.servicios.set(this.servicios().filter(s => s.id !== target));
      },
      error: (_e: HttpErrorResponse) => {
        this.eliminando.set(false);
        this.error.set('No se pudo eliminar.');
      },
    });
  }

  protected puedeEliminar(): boolean { return this.auth.tieneAlgunRol('EMPLEADOR','ADMINISTRADOR'); }
}
