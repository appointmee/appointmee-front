import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { sucursalService } from '../../services/sucursal-service';
import { AuthService } from '../../services/auth-service';

@Component({
  selector: 'app-eliminar-sucursal',
  imports: [FormsModule],
  templateUrl: './eliminar-sucursal.html',
  styleUrl: './eliminar-sucursal.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EliminarSucursal {
  private readonly api = inject(sucursalService);
  protected readonly auth = inject(AuthService);

  sucursalId: number | null = null;
  protected readonly eliminando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly exito = signal<string | null>(null);
  protected puedeEliminar(): boolean { return this.auth.tieneAlgunRol('EMPLEADOR','ADMINISTRADOR'); }

  protected eliminar(): void {
    if (!this.sucursalId) {
      this.error.set('Ingresá un ID de sucursal.');
      return;
    }
    if (!window.confirm('¿Confirmás la eliminación?')) return;
    this.eliminando.set(true);
    this.error.set(null);
    this.api.eliminar(this.sucursalId).subscribe({
      next: () => {
        this.eliminando.set(false);
        this.exito.set('Sucursal eliminada correctamente.');
      },
      error: (_e: HttpErrorResponse) => {
        this.eliminando.set(false);
        this.error.set('No se pudo eliminar la sucursal.');
      },
    });
  }
}
