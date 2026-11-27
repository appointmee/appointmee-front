import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subject, catchError, map, of, startWith, switchMap } from 'rxjs';

import { SolicitudEmpleadoLista } from '../../components/solicitud-empleado-lista/solicitud-empleado-lista';
import { mensajeErrorSolicitudEmpleado } from '../../http/solicitud-empleado-errors';
import { TAMANO_PAGINA } from '../../models/paginacion';
import {
  PaginaSolicitudesEmpleadoSucursalDTO,
  SolicitudEmpleadoVista,
  vistaSolicitudEnviada,
} from '../../models/solicitud-empleado';
import { DsPaginationComponent } from '../../shared/ui/misc/misc.component';
import { solicitudEmpleadoService } from '../../services/solicitud-empleado-service';

type ResultadoLista =
  | { readonly ok: true; readonly pagina: PaginaSolicitudesEmpleadoSucursalDTO }
  | { readonly ok: false; readonly error: HttpErrorResponse };

@Component({
  selector: 'app-solicitudes-empleado-enviadas-historial',
  imports: [DsPaginationComponent, RouterLink, SolicitudEmpleadoLista],
  templateUrl: './solicitudes-empleado-enviadas-historial.html',
  styleUrl: './solicitudes-empleado-enviadas-historial.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SolicitudesEmpleadoEnviadasHistorial {
  private readonly api = inject(solicitudEmpleadoService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly recargar = new Subject<void>();

  protected readonly sucursalId = signal<number | null>(null);
  protected readonly solicitudes = signal<readonly SolicitudEmpleadoVista[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly reintentando = signal(false);

  /** Página 0-based pedida al backend y metadatos que él informa. */
  protected readonly pagina = signal(0);
  protected readonly totalPaginas = signal(0);
  protected readonly total = signal(0);
  protected readonly tamanoPagina = TAMANO_PAGINA;

  constructor() {
    this.route.paramMap
      .pipe(
        map((params) => {
          const id = Number(params.get('sucursalId'));
          return Number.isInteger(id) && id > 0 ? id : null;
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((id) => {
        this.sucursalId.set(id);
        this.solicitudes.set([]);
        this.error.set(null);
        this.pagina.set(0);
        this.totalPaginas.set(0);
        this.total.set(0);
        this.cargando.set(true);
        this.recargar.next();
      });

    this.recargar
      .pipe(
        startWith(undefined as void),
        switchMap(() => {
          this.cargando.set(true);

          // Nunca se pide una página que el backend ya informó que no existe.
          const ultimaPagina = Math.max(0, this.totalPaginas() - 1);
          const page = Math.min(this.pagina(), ultimaPagina);
          if (page !== this.pagina()) this.pagina.set(page);

          const id = this.sucursalId();
          if (id === null) {
            return of<ResultadoLista>({
              ok: true,
              pagina: {
                content: [],
                totalElements: 0,
                totalPages: 0,
                number: 0,
                size: TAMANO_PAGINA,
              },
            });
          }

          return this.api.listarEnviadasPaginadas(id, page).pipe(
            map((pagina): ResultadoLista => ({ ok: true, pagina })),
            catchError((error: HttpErrorResponse) => of<ResultadoLista>({ ok: false, error })),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((resultado) => this.aplicarLista(resultado));
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
    if (!resultado.ok) {
      this.error.set(mensajeErrorSolicitudEmpleado(resultado.error, 'carga'));
      this.cargando.set(false);
      this.reintentando.set(false);

      if (this.solicitudes().length === 0) {
        this.pagina.set(0);
        this.totalPaginas.set(0);
        this.total.set(0);
      }
      return;
    }

    const { content, totalElements, totalPages, number } = resultado.pagina;
    const paginaSegura = Math.min(Math.max(0, number), Math.max(0, totalPages - 1));

    this.error.set(null);
    this.solicitudes.set(content.map(vistaSolicitudEnviada));
    this.total.set(totalElements);
    this.totalPaginas.set(totalPages);
    this.pagina.set(paginaSegura);
    this.cargando.set(false);
    this.reintentando.set(false);
  }
}
