import { ChangeDetectionStrategy, Component, DestroyRef, HostListener, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { ServicioDTO } from '../../models/servicio';
import { servicioService } from '../../services/servicio-service';
import { DsButtonComponent } from '../../shared/ui/button/button.component';

@Component({
  selector: 'app-gestionar-servicios',
  imports: [DsButtonComponent, RouterLink],
  templateUrl: './gestionar-servicios.html',
  styleUrl: './gestionar-servicios.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GestionarServiciosPage {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(servicioService);
  private readonly destroyRef = inject(DestroyRef);
  readonly sucursalId = this.parseId(this.route.snapshot.paramMap.get('sucursalId'));

  readonly servicios = signal<readonly ServicioDTO[]>([]);
  readonly cargando = signal(false);
  readonly eliminandoId = signal<number | null>(null);
  readonly pendiente = signal<ServicioDTO | null>(null);
  readonly error = signal<string | null>(null);
  readonly exito = signal<string | null>(null);

  constructor() {
    if (this.sucursalId === null) {
      this.error.set('No se pudo identificar la sucursal.');
    } else {
      this.cargar();
    }
  }

  cargar(): void {
    if (this.cargando() || this.sucursalId === null) return;
    this.cargando.set(true);
    this.error.set(null);
    this.api.listarPorSucursal(this.sucursalId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: servicios => {
        this.servicios.set(servicios);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No pudimos cargar los servicios. Revisá tu conexión e intentá nuevamente.');
        this.cargando.set(false);
      },
    });
  }

  pedirConfirmacion(servicio: ServicioDTO): void {
    if (this.eliminandoId() !== null) return;
    this.error.set(null);
    this.exito.set(null);
    this.pendiente.set(servicio);
  }

  cancelar(): void {
    if (this.eliminandoId() === null) this.pendiente.set(null);
  }

  confirmar(): void {
    const servicio = this.pendiente();
    if (!servicio || this.eliminandoId() !== null) return;
    this.eliminandoId.set(servicio.id);
    this.error.set(null);
    this.api.eliminar(servicio.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.servicios.update(actuales => actuales.filter(actual => actual.id !== servicio.id));
        this.pendiente.set(null);
        this.eliminandoId.set(null);
        this.exito.set(`Se eliminó el servicio «${servicio.nombre}».`);
      },
      error: () => {
        this.eliminandoId.set(null);
        this.error.set('No pudimos eliminar el servicio. Revisá tu conexión e intentá nuevamente.');
      },
    });
  }

  @HostListener('document:keydown.escape')
  cerrarConEscape(): void {
    this.cancelar();
  }

  private parseId(value: string | null): number | null {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
  }
}
