import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Subject, catchError, map, of, startWith, switchMap } from 'rxjs';

import { SolicitudEmpleadorCard } from '../../components/solicitud-empleador-card/solicitud-empleador-card';
import { mensajeErrorSolicitud } from '../../http/solicitud-empleador-errors';
import { PaginaDTO, TAMANO_PAGINA } from '../../models/paginacion';
import {
  EstadoSolicitudEmpleador,
  SolicitudEmpleadorDetalleDTO,
  SolicitudEmpleadorMiniDTO,
} from '../../models/solicitud-empleador';
import { DsButtonComponent } from '../../shared/ui/button/button.component';
import { DsPaginationComponent } from '../../shared/ui/misc/misc.component';
import { solicitudEmpleadorService } from '../../services/solicitud-empleador-service';

type ResultadoLista =
  | { readonly ok: true; readonly pagina: PaginaDTO<SolicitudEmpleadorMiniDTO> }
  | { readonly ok: false; readonly error: HttpErrorResponse };

@Component({
  selector: 'app-solicitudes-historial',
  imports: [DsButtonComponent, DsPaginationComponent, RouterLink, SolicitudEmpleadorCard],
  templateUrl: './solicitudes-historial.html',
  styleUrl: './solicitudes-historial.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SolicitudesHistorial {
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

  /** Página 0-based pedida al backend y metadatos que él informa. */
  protected readonly pagina = signal(0);
  protected readonly totalPaginas = signal(0);
  protected readonly total = signal(0);
  protected readonly tamanoPagina = TAMANO_PAGINA;

  constructor() {
    this.recargar
      .pipe(
        startWith(undefined as void),
        switchMap(() => {
          this.cargando.set(true);

          // Nunca se pide una página que el backend ya informó que no existe.
          const ultimaPagina = Math.max(0, this.totalPaginas() - 1);
          const page = Math.min(this.pagina(), ultimaPagina);
          if (page !== this.pagina()) this.pagina.set(page);

          return this.api.listarPropiasPaginado(page).pipe(
            map((pagina): ResultadoLista => ({ ok: true, pagina })),
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
    if (this.reintentando()) return;
    this.reintentando.set(true);
    this.pagina.set(0);
    this.recargar.next();
  }

  /** `ds-pagination` es 1-based; el backend usa páginas 0-based. */
  protected cambiarPagina(paginaVisible: number): void {
    const ultimaPagina = Math.max(0, this.totalPaginas() - 1);
    const destino = Math.min(Math.max(0, paginaVisible - 1), ultimaPagina);
    if (destino === this.pagina()) return;

    this.pagina.set(destino);
    this.recargar.next();
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

    const { content, totalElements, totalPages, number } = resultado.pagina;
    const paginaSegura = Math.min(Math.max(0, number), Math.max(0, totalPages - 1));

    this.error.set(null);
    this.solicitudes.set(content);
    this.total.set(totalElements);
    this.totalPaginas.set(totalPages);
    this.pagina.set(paginaSegura);
    this.detalles.set(new Map());
    this.erroresDetalle.set(new Map());
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
