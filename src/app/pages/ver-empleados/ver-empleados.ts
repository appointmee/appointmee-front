import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { EmpleadoDTO } from '../../models/empleado';
import { empleadoService } from '../../services/empleado-service';

@Component({
  selector: 'app-ver-empleados',
  imports: [FormsModule],
  templateUrl: './ver-empleados.html',
  styleUrl: './ver-empleados.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VerEmpleados {
  private readonly api = inject(empleadoService);

  sucursalId: number | null = null;
  protected readonly empleados = signal<readonly EmpleadoDTO[]>([]);
  protected readonly cargando = signal(false);
  protected readonly error = signal<string | null>(null);

  protected cargar(): void {
    if (!this.sucursalId) return;
    this.cargando.set(true);
    this.error.set(null);
    this.api.listarPorSucursal(this.sucursalId).subscribe({
      next: (e) => { this.empleados.set(e); this.cargando.set(false); },
      error: (_e: HttpErrorResponse) => { this.cargando.set(false); this.error.set('No se pudieron cargar los empleados.'); },
    });
  }
}
