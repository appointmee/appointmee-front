import { DsButtonComponent } from '../../shared/ui/button/button.component';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Subject, catchError, map, of, startWith, switchMap } from 'rxjs';

import {
  AccionSolicitudEmpleador,
  SolicitudEmpleadorCard,
} from '../../components/solicitud-empleador-card/solicitud-empleador-card';
import { SolicitanteSolicitudEmpleador } from '../../components/solicitud-empleador-detalle/solicitud-empleador-detalle';
import { mensajeErrorSolicitud } from '../../http/solicitud-empleador-errors';
import {
  EstadoSolicitudEmpleador,
  SolicitudEmpleadorDetalleDTO,
  SolicitudEmpleadorMiniDTO,
} from '../../models/solicitud-empleador';
import { solicitudEmpleadorService } from '../../services/solicitud-empleador-service';

type ResultadoLista =
  | { readonly ok: true; readonly solicitudes: readonly SolicitudEmpleadorMiniDTO[] }
  | { readonly ok: false; readonly error: HttpErrorResponse };

@Component({
  selector: 'app-admin',
  imports: [DsButtonComponent, SolicitudEmpleadorCard, RouterLink],
  templateUrl: './admin.html',
  styleUrl: './admin.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Administracion {
  private readonly api = inject(solicitudEmpleadorService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly recargar = new Subject<void>();

  private revision = 0;

  protected readonly solicitudes = signal<readonly SolicitudEmpleadorMiniDTO[]>([]);
  protected readonly detalles = signal<ReadonlyMap<number, SolicitudEmpleadorDetalleDTO>>(new Map());
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly reintentando = signal(false);
  protected readonly expandidas = signal<ReadonlySet<number>>(new Set());
  protected readonly cargandoDetalle = signal<ReadonlySet<number>>(new Set());
  protected readonly erroresDetalle = signal<ReadonlyMap<number, string>>(new Map());
  protected readonly resolviendo = signal<ReadonlyMap<number, AccionSolicitudEmpleador>>(new Map());
  protected readonly erroresAccion = signal<ReadonlyMap<number, string>>(new Map());
  protected readonly exito = signal<string | null>(null);

  protected readonly total = computed(() => this.solicitudes().length);
  protected readonly pendientes = computed(
    () =>
      this.solicitudes().filter((solicitud) => {
        const detalle = this.detalles().get(solicitud.id);
        return !detalle || detalle.estado === 'PENDIENTE';
      }).length,
  );
  protected readonly hayResueltas = computed(() => this.pendientes() < this.total());

  constructor() {
    this.recargar
      .pipe(
        startWith(undefined as void),
        switchMap(() => {
          this.cargando.set(this.solicitudes().length === 0);
          return this.api.listarPendientes().pipe(
            map((solicitudes): ResultadoLista => ({ ok: true, solicitudes })),
            catchError((error: HttpErrorResponse) => of<ResultadoLista>({ ok: false, error })),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((resultado) => this.aplicarLista(resultado));
  }

  protected detalleDe(id: number): SolicitudEmpleadorDetalleDTO | null {
    return this.detalles().get(id) ?? null;
  }

  protected estadoDe(id: number): EstadoSolicitudEmpleador | null {
    return this.detalles().get(id)?.estado ?? 'PENDIENTE';
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

  protected resolviendoDe(id: number): AccionSolicitudEmpleador | null {
    return this.resolviendo().get(id) ?? null;
  }

  protected errorAccionDe(id: number): string | null {
    return this.erroresAccion().get(id) ?? null;
  }

  protected solicitanteDe(solicitud: SolicitudEmpleadorMiniDTO): SolicitanteSolicitudEmpleador {
    return {
      nombre: solicitud.nombreUsuario,
      apellido: solicitud.apellidoUsuario,
    };
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

  protected reintentar(): void {
    if (this.reintentando()) return;
    this.reintentando.set(true);
    this.recargar.next();
  }

  protected aprobar(id: number): void {
    this.resolver(id, 'aprobar');
  }

  protected rechazar(id: number): void {
    this.resolver(id, 'rechazar');
  }

  private resolver(id: number, accion: AccionSolicitudEmpleador): void {
    if (this.resolviendo().has(id)) return;

    const detalle = this.detalles().get(id);
    if (!detalle || detalle.estado !== 'PENDIENTE') return;

    this.exito.set(null);
    this.resolviendo.update((actual) => new Map(actual).set(id, accion));
    this.erroresAccion.update((actual) => {
      const siguiente = new Map(actual);
      siguiente.delete(id);
      return siguiente;
    });

    const peticion = accion === 'aprobar' ? this.api.aprobar(id) : this.api.rechazar(id);

    peticion.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        const estado: EstadoSolicitudEmpleador = accion === 'aprobar' ? 'APROBADA' : 'RECHAZADA';

        this.detalles.update((actual) => {
          const solicitud = actual.get(id);
          if (!solicitud) return actual;
          return new Map(actual).set(id, { ...solicitud, estado });
        });
        this.quitarResolviendo(id);
        this.exito.set(
          accion === 'aprobar'
            ? 'La solicitud fue aprobada. La persona ya cuenta con el rol de empleador.'
            : 'La solicitud fue rechazada. La persona va a poder consultar el estado en su historial.',
        );
      },
      error: (error: HttpErrorResponse) => {
        this.quitarResolviendo(id);
        this.erroresAccion.update((actual) =>
          new Map(actual).set(id, mensajeErrorSolicitud(error, 'resolucion')),
        );
      },
    });
  }

  private quitarResolviendo(id: number): void {
    this.resolviendo.update((actual) => {
      const siguiente = new Map(actual);
      siguiente.delete(id);
      return siguiente;
    });
  }

  private aplicarLista(resultado: ResultadoLista): void {
    this.revision++;

    if (!resultado.ok) {
      this.error.set(mensajeErrorSolicitud(resultado.error, 'carga'));
      this.cargando.set(false);
      this.reintentando.set(false);

      if (this.solicitudes().length === 0) {
        this.detalles.set(new Map());
        this.expandidas.set(new Set());
      }
      return;
    }

    this.error.set(null);
    this.solicitudes.set(resultado.solicitudes);
    this.detalles.set(new Map());
    this.erroresDetalle.set(new Map());
    this.erroresAccion.set(new Map());
    this.resolviendo.set(new Map());
    this.cargandoDetalle.set(new Set());
    this.expandidas.set(new Set());
    this.cargando.set(false);
    this.reintentando.set(false);
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
            new Map(actual).set(id, mensajeErrorSolicitud(error, 'detalle')),
          );
        },
      });
  }
}
