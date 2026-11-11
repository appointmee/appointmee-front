import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { SucursalMiniDTO } from '../../models/sucursal';
import { sucursalService } from '../../services/sucursal-service';
import { AuthService } from '../../services/auth-service';

@Component({
  selector: 'app-eliminar-sucursal',
  templateUrl: './eliminar-sucursal.html',
  styleUrl: './eliminar-sucursal.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EliminarSucursal {
  private readonly api = inject(sucursalService);
  protected readonly auth = inject(AuthService);

  protected readonly sucursales = signal<readonly SucursalMiniDTO[]>([]);
  protected readonly eliminando = signal(false);
  protected readonly cargando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly exito = signal<string | null>(null);

  constructor() { this.cargar(); }

  protected cargar(): void {
    this.cargando.set(true);
    this.api.listarPropias().subscribe({
      next: (s) => { this.sucursales.set(s); this.cargando.set(false); },
      error: () => { this.cargando.set(false); this.error.set('No se pudieron cargar las sucursales.'); },
    });
  }

  protected eliminar(id: number): void {
    if (!this.auth.tieneAlgunRol('EMPLEADOR','ADMINISTRADOR')) { this.error.set('Sin permisos.'); return; }
    if (!window.confirm('¿Confirmás la eliminación?')) return;
    this.eliminando.set(true);
    this.error.set(null);
    this.api.eliminar(id).subscribe({
      next: () => {
        this.eliminando.set(false);
        this.exito.set('Sucursal eliminada.');
        this.sucursales.set(this.sucursales().filter(s => s.id !== id));
      },
      error: (_e: HttpErrorResponse) => {
        this.eliminando.set(false);
        this.error.set('No se pudo eliminar.');
      },
    });
  }

  protected puedeEliminar(): boolean { return this.auth.tieneAlgunRol('EMPLEADOR','ADMINISTRADOR'); }
}
