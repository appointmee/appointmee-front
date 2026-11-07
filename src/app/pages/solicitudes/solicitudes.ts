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
import { Subject, catchError, forkJoin, map, of, startWith, switchMap } from 'rxjs';

import { SolicitudEmpleadorCard } from '../../components/solicitud-empleador-card/solicitud-empleador-card';
import { SolicitudEmpleadorModal } from '../../components/solicitud-empleador-modal/solicitud-empleador-modal';
import { mensajeErrorSolicitud } from '../../http/solicitud-empleador-errors';
import {
  EstadoSolicitudEmpleador,
  SolicitudEmpleadorDetalleDTO,
  SolicitudEmpleadorMiniDTO,
} from '../../models/solicitud-empleador';
import { authService } from '../../services/auth-service';
import { solicitudEmpleadorService } from '../../services/solicitud-empleador-service';

const SOLICITUDES_VISIBLES = 3;

type ResultadoLista =
  | { readonly ok: true; readonly solicitudes: readonly SolicitudEmpleadorMiniDTO[] }
  | { readonly ok: false; readonly error: HttpErrorResponse };

@Component({
  selector: 'app-solicitudes',
  imports: [RouterLink, SolicitudEmpleadorCard, SolicitudEmpleadorModal],
  templateUrl: './solicitudes.html',
  styleUrl: './solicitudes.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Solicitudes {
  private readonly api = inject(solicitudEmpleadorService);
  private readonly auth = inject(authService);
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

  protected readonly modalAbierto = signal(false);
  protected readonly enviando = signal(false);
  protected readonly errorEnvio = signal<string | null>(null);
  protected readonly exito = signal<string | null>(null);

  protected readonly visibles = computed(() =>
    this.solicitudes().slice(0, SOLICITUDES_VISIBLES),
  );
  protected readonly hayMas = computed(() => this.solicitudes().length > SOLICITUDES_VISIBLES);
  protected readonly total = computed(() => this.solicitudes().length);
  protected readonly rolSinPermiso = computed(() =>
    this.auth.tieneAlgunRol('ADMINISTRADOR'),
  );
  protected readonly esEmpleador = computed(() => this.auth.tieneAlgunRol('EMPLEADOR'));
  protected readonly tienePendiente = computed(() =>
    [...this.detalles().values()].some((detalle) => detalle.estado === 'PENDIENTE'),
  );
  protected readonly puedeSolicitar = computed(
    () => !this.rolSinPermiso() && !this.tienePendiente(),
  );

  constructor() {
    if (this.rolSinPermiso()) {
      this.cargando.set(false);
      return;
    }

    this.recargar
      .pipe(
        startWith(undefined as void),
        switchMap(() => {
          this.cargando.set(this.solicitudes().length === 0);
          return this.api.listarPropias().pipe(
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
    return this.detalles().get(id)?.estado ?? null;
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
    if (this.reintentando() || this.rolSinPermiso()) return;
    this.reintentando.set(true);
    this.recargar.next();
  }

  protected abrirModal(): void {
    if (!this.puedeSolicitar()) return;
    this.errorEnvio.set(null);
    this.modalAbierto.set(true);
  }

  protected cerrarModal(): void {
    if (this.enviando()) return;
    this.modalAbierto.set(false);
    this.errorEnvio.set(null);
  }

  protected limpiarErrorEnvio(): void {
    this.errorEnvio.set(null);
  }

  protected enviarSolicitud(motivo: string): void {
    if (this.enviando() || !this.puedeSolicitar()) return;

    this.enviando.set(true);
    this.errorEnvio.set(null);

    this.api
      .solicitar(motivo)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.enviando.set(false);
          this.modalAbierto.set(false);
          this.exito.set(
            'Tu solicitud se envió correctamente. Un administrador va a revisarla y vas a poder seguir el estado desde acá.',
          );
          this.recargar.next();
        },
        error: (error: HttpErrorResponse) => {
          this.enviando.set(false);
          this.errorEnvio.set(mensajeErrorSolicitud(error, 'envio'));
        },
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
    this.cargandoDetalle.set(new Set());
    this.expandidas.set(new Set());
    this.cargando.set(false);
    this.reintentando.set(false);
    this.precargarDetalles(this.visibles());
  }

  /** Solo se consultan los detalles de las tres solicitudes visibles. */
  private precargarDetalles(solicitudes: readonly SolicitudEmpleadorMiniDTO[]): void {
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

    this.api
      .verDetalle(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (detalle) => {
          this.detalles.update((actual) => new Map(actual).set(id, detalle));
          this.cargandoDetalle.update((actual) => {
            const siguiente = new Set(actual);
            siguiente.delete(id);
            return siguiente;
          });
        },
        error: (error: HttpErrorResponse) => {
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
