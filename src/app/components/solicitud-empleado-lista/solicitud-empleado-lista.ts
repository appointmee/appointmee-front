import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, forkJoin, map, of } from 'rxjs';

import { mensajeErrorSolicitudEmpleado } from '../../http/solicitud-empleado-errors';
import {
  AccionSolicitudEmpleado,
  EstadoSolicitudEmpleado,
  ResultadoResolucionSolicitudEmpleado,
  SolicitudEmpleadoDetalleDTO,
  SolicitudEmpleadoVista,
  TipoSolicitudEmpleado,
} from '../../models/solicitud-empleado';
import { solicitudEmpleadoService } from '../../services/solicitud-empleado-service';
import { SolicitudEmpleadoCard } from '../solicitud-empleado-card/solicitud-empleado-card';

/**
 * Lista de invitaciones con detalle bajo demanda. Centraliza la expansión, el
 * reintento y las acciones para que los paneles y los historiales no dupliquen
 * la misma lógica.
 */
@Component({
  selector: 'app-solicitud-empleado-lista',
  imports: [SolicitudEmpleadoCard],
  templateUrl: './solicitud-empleado-lista.html',
  styleUrl: './solicitud-empleado-lista.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SolicitudEmpleadoLista {
  private readonly api = inject(solicitudEmpleadoService);
  private readonly destroyRef = inject(DestroyRef);

  readonly solicitudes = input.required<readonly SolicitudEmpleadoVista[]>();
  readonly tipo = input.required<TipoSolicitudEmpleado>();
  /** Precarga el detalle de todas las tarjetas recibidas (paneles compactos). */
  readonly precargarVisibles = input(true);

  readonly solicitudResuelta = output<ResultadoResolucionSolicitudEmpleado>();

  protected readonly detalles = signal<ReadonlyMap<number, SolicitudEmpleadoDetalleDTO>>(
    new Map(),
  );
  protected readonly expandidas = signal<ReadonlySet<number>>(new Set());
  protected readonly cargandoDetalle = signal<ReadonlySet<number>>(new Set());
  protected readonly erroresDetalle = signal<ReadonlyMap<number, string>>(new Map());
  protected readonly resolviendoId = signal<number | null>(null);
  protected readonly accionResolviendo = signal<AccionSolicitudEmpleado | null>(null);
  protected readonly erroresAccion = signal<ReadonlyMap<number, string>>(new Map());

  private revision = 0;
  private listaAnterior: readonly SolicitudEmpleadoVista[] = [];

  constructor() {
    effect(() => {
      const solicitudes = this.solicitudes();
      if (solicitudes === this.listaAnterior) return;

      this.listaAnterior = solicitudes;
      this.reiniciar(solicitudes);
    });
  }

  protected detalleDe(id: number): SolicitudEmpleadoDetalleDTO | null {
    return this.detalles().get(id) ?? null;
  }

  protected estaExpandida(id: number): boolean {
    return this.expandidas().has(id);
  }

  protected estaCargandoDetalle(id: number): boolean {
    return this.cargandoDetalle().has(id);
  }

  protected errorDetalleDe(id: number): string | null {
    return this.erroresDetalle().get(id) ?? null;
  }

  protected resolviendoDe(id: number): AccionSolicitudEmpleado | null {
    return this.resolviendoId() === id ? this.accionResolviendo() : null;
  }

  protected errorAccionDe(id: number): string | null {
    return this.erroresAccion().get(id) ?? null;
  }

  protected alternar(id: number): void {
    const abiertas = new Set(this.expandidas());
    const estabaAbierta = abiertas.has(id);

    if (estabaAbierta) {
      abiertas.delete(id);
    } else {
      abiertas.add(id);
      if (!this.detalles().has(id)) {
        this.cargarDetalle(id);
      }
    }

    this.expandidas.set(abiertas);
  }

  protected reintentarDetalle(id: number): void {
    if (this.cargandoDetalle().has(id)) return;
    this.cargarDetalle(id);
  }

  protected aprobar(id: number): void {
    this.resolver(id, 'aprobar');
  }

  protected rechazar(id: number): void {
    this.resolver(id, 'rechazar');
  }

  private reiniciar(solicitudes: readonly SolicitudEmpleadoVista[]): void {
    this.revision++;
    this.detalles.set(new Map());
    this.expandidas.set(new Set());
    this.cargandoDetalle.set(new Set());
    this.erroresDetalle.set(new Map());
    this.erroresAccion.set(new Map());
    this.resolviendoId.set(null);
    this.accionResolviendo.set(null);

    if (this.precargarVisibles()) {
      this.precargar(solicitudes);
    }
  }

  private precargar(solicitudes: readonly SolicitudEmpleadoVista[]): void {
    if (solicitudes.length === 0) return;

    const revision = this.revision;

    forkJoin(
      solicitudes.map((solicitud) =>
        this.api.verDetalle(solicitud.id).pipe(
          map((detalle) => ({ detalle })),
          catchError(() => of({ detalle: null })),
        ),
      ),
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((resultados) => {
        if (revision !== this.revision) return;

        const detalles = new Map(this.detalles());
        for (const resultado of resultados) {
          if (resultado.detalle) detalles.set(resultado.detalle.id, resultado.detalle);
        }
        this.detalles.set(detalles);
      });
  }

  private cargarDetalle(id: number): void {
    if (this.cargandoDetalle().has(id)) return;

    this.cargandoDetalle.update((actual) => new Set(actual).add(id));
    this.erroresDetalle.update((actual) => {
      const siguiente = new Map(actual);
      siguiente.delete(id);
      return siguiente;
    });

    const revision = this.revision;

    this.api
      .verDetalle(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (detalle) => {
          if (revision !== this.revision) return;

          this.detalles.update((actual) => new Map(actual).set(id, detalle));
          this.cargandoDetalle.update((actual) => {
            const siguiente = new Set(actual);
            siguiente.delete(id);
            return siguiente;
          });
        },
        error: (error: HttpErrorResponse) => {
          if (revision !== this.revision) return;

          this.cargandoDetalle.update((actual) => {
            const siguiente = new Set(actual);
            siguiente.delete(id);
            return siguiente;
          });
          this.erroresDetalle.update((actual) =>
            new Map(actual).set(id, mensajeErrorSolicitudEmpleado(error, 'detalle')),
          );
        },
      });
  }

  private resolver(id: number, accion: AccionSolicitudEmpleado): void {
    if (this.resolviendoId() !== null) return;

    this.resolviendoId.set(id);
    this.accionResolviendo.set(accion);
    this.erroresAccion.update((actual) => {
      const siguiente = new Map(actual);
      siguiente.delete(id);
      return siguiente;
    });

    const peticion = accion === 'aprobar' ? this.api.aprobar(id) : this.api.rechazar(id);

    peticion.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        const estado: EstadoSolicitudEmpleado = accion === 'aprobar' ? 'APROBADA' : 'RECHAZADA';
        this.detalles.update((actual) => {
          const detalle = actual.get(id);
          if (!detalle) return actual;
          return new Map(actual).set(id, { ...detalle, estadoSolicitud: estado });
        });

        this.resolviendoId.set(null);
        this.accionResolviendo.set(null);
        this.solicitudResuelta.emit({ id, estado, accion });
      },
      error: (error: HttpErrorResponse) => {
        this.resolviendoId.set(null);
        this.accionResolviendo.set(null);
        this.erroresAccion.update((actual) =>
          new Map(actual).set(id, mensajeErrorSolicitudEmpleado(error, 'resolucion')),
        );
      },
    });
  }
}
