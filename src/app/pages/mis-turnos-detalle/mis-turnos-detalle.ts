import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { TurnoClienteDetalleDTO } from '../../models/turno';
import { turnoService } from '../../services/turno-service';

@Component({
  selector: 'app-mis-turnos-detalle',
  template: `
    <section class="detalle">
      @if (cargando()) { <p role="status">Cargando detalle…</p> }
      @else if (error()) { <p role="alert">{{ error() }}</p> }
      @else if (detalle()) {
        <h1>{{ detalle()!.servicio.nombre }}</h1>
        <p>Estado: {{ detalle()!.estadoTurno }}</p>
        <p>Fecha: {{ detalle()!.fechaHora }}</p>
        <p>Empleado: {{ detalle()!.empleado.nombre }} {{ detalle()!.empleado.apellido }}</p>
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MisTurnosDetalle {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(turnoService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly detalle = signal<TurnoClienteDetalleDTO | null>(null);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);

  constructor() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) {
      this.cargando.set(false);
      this.error.set('ID inválido.');
      return;
    }
    this.api.detallePropio(id).subscribe({
      next: (d) => {
        this.detalle.set(d);
        this.cargando.set(false);
      },
      error: (_e: HttpErrorResponse) => {
        this.cargando.set(false);
        this.error.set('No se pudo cargar el detalle.');
      },
    });
  }
}
