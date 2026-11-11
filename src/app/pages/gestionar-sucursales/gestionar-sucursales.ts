import { ChangeDetectionStrategy, Component, DestroyRef, HostListener, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { SucursalMiniDTO } from '../../models/sucursal';
import { authService } from '../../services/auth-service';
import { sucursalService } from '../../services/sucursal-service';
import { DsButtonComponent } from '../../shared/ui/button/button.component';

@Component({
  selector: 'app-gestionar-sucursales',
  imports: [DsButtonComponent, RouterLink],
  templateUrl: './gestionar-sucursales.html',
  styleUrl: './gestionar-sucursales.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GestionarSucursalesPage {
  private readonly api = inject(sucursalService);
  private readonly auth = inject(authService);
  private readonly destroyRef = inject(DestroyRef);

  readonly esAdmin = computed(() => this.auth.tieneAlgunRol('ADMINISTRADOR'));
  readonly sucursales = signal<readonly SucursalMiniDTO[]>([]);
  readonly cargando = signal(false);
  readonly eliminandoId = signal<number | null>(null);
  readonly pendiente = signal<SucursalMiniDTO | null>(null);
  readonly error = signal<string | null>(null);
  readonly exito = signal<string | null>(null);

  constructor() { this.cargar(); }

  cargar(): void {
    if (this.cargando()) return;
    this.cargando.set(true);
    this.error.set(null);
    const request = this.esAdmin() ? this.api.listar(true) : this.api.listarPropias();
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: sucursales => {
        this.sucursales.set(sucursales);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No pudimos cargar las sucursales. Revisá tu conexión e intentá nuevamente.');
        this.cargando.set(false);
      },
    });
  }

  pedirConfirmacion(sucursal: SucursalMiniDTO): void {
    if (this.eliminandoId() !== null) return;
    this.pendiente.set(sucursal);
    this.error.set(null);
    this.exito.set(null);
  }

  cancelar(): void {
    if (this.eliminandoId() === null) this.pendiente.set(null);
  }

  confirmar(): void {
    const sucursal = this.pendiente();
    if (!sucursal || this.eliminandoId() !== null) return;
    this.eliminandoId.set(sucursal.id);
    this.error.set(null);
    const request = this.esAdmin()
      ? this.api.eliminar(sucursal.id)
      : this.api.eliminarPropia(sucursal.id);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.sucursales.update(actuales => actuales.filter(actual => actual.id !== sucursal.id));
        this.pendiente.set(null);
        this.eliminandoId.set(null);
        this.exito.set(`Se eliminó la sucursal «${sucursal.nombre}».`);
      },
      error: () => {
        this.eliminandoId.set(null);
        this.error.set('No pudimos eliminar la sucursal. Revisá tus permisos y volvé a intentar.');
      },
    });
  }

  @HostListener('document:keydown.escape')
  cerrarConEscape(): void { this.cancelar(); }
}
