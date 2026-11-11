import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { empleadoService } from '../../services/empleado-service';

@Component({
  selector: 'app-eliminar-empleado',
  imports: [FormsModule],
  templateUrl: './eliminar-empleado.html',
  styleUrl: './eliminar-empleado.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EliminarEmpleado {
  private readonly api = inject(empleadoService);

  sucursalId: number | null = null;
  empleadoId: number | null = null;
  protected readonly eliminando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly exito = signal<string | null>(null);

  protected eliminar(): void {
    if (!this.sucursalId || !this.empleadoId) {
      this.error.set('Ingresá sucursal y empleado.');
      return;
    }
    if (!window.confirm('¿Confirmás la eliminación?')) return;
    this.eliminando.set(true);
    this.error.set(null);
    this.api.eliminar(this.sucursalId, this.empleadoId).subscribe({
      next: () => { this.eliminando.set(false); this.exito.set('Empleado eliminado.'); },
      error: (_e: HttpErrorResponse) => { this.eliminando.set(false); this.error.set('No se pudo eliminar.'); },
    });
  }
}
