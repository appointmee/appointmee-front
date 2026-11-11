import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { EmpleadoDTO } from '../../models/empleado';
import { empleadoService } from '../../services/empleado-service';
import { authService } from "../../services/auth-service";

@Component({
  selector: 'app-eliminar-empleado',
  imports: [FormsModule],
  templateUrl: './eliminar-empleado.html',
  styleUrl: './eliminar-empleado.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EliminarEmpleado {
  private readonly api = inject(empleadoService);
  protected readonly auth = inject(authService);

  sucursalId: number | null = null;
  protected readonly empleados = signal<readonly EmpleadoDTO[]>([]);
  protected readonly eliminando = signal(false);
  protected readonly cargando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly exito = signal<string | null>(null);

  protected cargar(): void {
    if (!this.sucursalId) return;
    this.cargando.set(true);
    this.api.listarPorSucursal(this.sucursalId).subscribe({
      next: (e) => { this.empleados.set(e); this.cargando.set(false); },
      error: () => { this.cargando.set(false); this.error.set('No se pudieron cargar los empleados.'); },
    });
  }

  protected eliminar(id: number): void {
    if (!this.sucursalId) { this.error.set('Ingresá sucursal.'); return; }
    if (!this.auth.tieneAlgunRol('EMPLEADOR')) { this.error.set('Sin permisos.'); return; }
    if (!window.confirm('¿Confirmás la eliminación?')) return;
    this.eliminando.set(true);
    this.error.set(null);
    this.api.eliminar(this.sucursalId, id).subscribe({
      next: () => {
        this.eliminando.set(false);
        this.exito.set('Empleado eliminado.');
        this.empleados.set(this.empleados().filter(e => e.id !== id));
      },
      error: (_e: HttpErrorResponse) => {
        this.eliminando.set(false);
        this.error.set('No se pudo eliminar.');
      },
    });
  }

  protected puedeEliminar(): boolean { return this.auth.tieneAlgunRol('EMPLEADOR'); }
}
