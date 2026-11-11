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
import {
  Observable,
  Subject,
  Subscription,
  catchError,
  forkJoin,
  map,
  of,
  startWith,
  switchMap,
} from 'rxjs';

import { DsButtonComponent } from '../../shared/ui/button/button.component';
import {
  DsModalComponent,
  DsSelectComponent,
} from '../../shared/ui/misc/misc.component';
import { EstadoTurno, TurnoClienteDetalleDTO, TurnoMiniDTO } from '../../models/turno';
import { SucursalMiniDTO } from '../../models/sucursal';
import { servicioService } from '../../services/servicio-service';
import { sucursalService } from '../../services/sucursal-service';
import { turnoService } from '../../services/turno-service';

type FiltroEstado = EstadoTurno | 'TODOS';

type ResultadoLista =
  | { readonly ok: true; readonly turnos: readonly TurnoMiniDTO[] }
  | { readonly ok: false; readonly error: unknown };

type ContextoError = 'lista' | 'detalle' | 'sucursal';

interface OpcionEstado {
  readonly valor: FiltroEstado;
  readonly etiqueta: string;
}

const ESTADOS: readonly OpcionEstado[] = [
  { valor: 'TODOS', etiqueta: 'Todos' },
  { valor: 'PENDIENTE', etiqueta: 'Pendiente' },
  { valor: 'CONFIRMADO', etiqueta: 'Confirmado' },
  { valor: 'REALIZADO', etiqueta: 'Realizado' },
  { valor: 'CANCELADO', etiqueta: 'Cancelado' },
  { valor: 'PAGO_RECHAZADO', etiqueta: 'Pago rechazado' },
];

const ETIQUETAS_ESTADO: Readonly<Record<EstadoTurno, string>> = {
  PENDIENTE: 'Pendiente',
  CONFIRMADO: 'Confirmado',
  REALIZADO: 'Realizado',
  CANCELADO: 'Cancelado',
  PAGO_RECHAZADO: 'Pago rechazado',
};

interface PartesFecha {
  readonly anio: number;
  readonly mes: number;
  readonly dia: number;
  readonly hora: number;
  readonly minuto: number;
  readonly segundo: number;
}

@Component({
  selector: 'app-mis-turnos',
  imports: [DsButtonComponent, DsModalComponent, DsSelectComponent, RouterLink],
  templateUrl: './mis-turnos.html',
  styleUrl: './mis-turnos.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MisTurnos {
  private readonly turnosApi = inject(turnoService);
  private readonly serviciosApi = inject(servicioService);
  private readonly sucursalesApi = inject(sucursalService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly recargar = new Subject<void>();
  private readonly formatoMoneda = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
  });

  private detalleSub?: Subscription;
  private sucursalSub?: Subscription;
  private detalleRevision = 0;

  protected readonly estados = ESTADOS;
  protected readonly filtro = signal<FiltroEstado>('TODOS');
  protected readonly turnos = signal<readonly TurnoMiniDTO[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly reintentando = signal(false);

  protected readonly turnoSeleccionado = signal<TurnoMiniDTO | null>(null);
  protected readonly detalle = signal<TurnoClienteDetalleDTO | null>(null);
  protected readonly detalleCargando = signal(false);
  protected readonly detalleError = signal<string | null>(null);
  protected readonly detalleReintentando = signal(false);

  protected readonly sucursal = signal<SucursalMiniDTO | null>(null);
  protected readonly sucursalCargando = signal(false);
  protected readonly sucursalError = signal<string | null>(null);
  private readonly fotoSucursalFallida = signal<string | null>(null);

  protected readonly turnosFiltrados = computed(() => {
    const filtro = this.filtro();
    return filtro === 'TODOS'
      ? this.turnos()
      : this.turnos().filter((turno) => turno.estadoTurno === filtro);
  });

  protected readonly detalleTitulo = computed(
    () =>
      this.detalle()?.servicio.nombre ??
      this.turnoSeleccionado()?.nombreServicio ??
      'Detalle del turno',
  );

  protected readonly detalleEstado = computed<EstadoTurno | null>(
    () => this.detalle()?.estadoTurno ?? this.turnoSeleccionado()?.estadoTurno ?? null,
  );

  protected readonly finDetalle = computed(() => {
    const detalle = this.detalle();
    return detalle
      ? this.sumarMinutos(detalle.fechaHora, detalle.servicio.duracion)
      : '—';
  });

  protected readonly fotoSucursal = computed(() => {
    const foto = this.sucursal()?.fotoPerfil?.trim();
    return foto && foto !== this.fotoSucursalFallida() ? foto : null;
  });

  protected readonly puntuacionSucursal = computed(() => this.sucursal()?.puntuacion ?? 0);

  protected readonly abejasSucursal = computed(() => {
    const puntuacion = Math.round(this.puntuacionSucursal());
    return [1, 2, 3, 4, 5].map((posicion) => posicion <= puntuacion);
  });

  constructor() {
    this.recargar
      .pipe(
        startWith(undefined as void),
        switchMap(() => {
          this.cargando.set(this.turnos().length === 0 && !this.error());
          return this.turnosApi.propios().pipe(
            map((turnos): ResultadoLista => ({ ok: true, turnos })),
            catchError((error: unknown) => of<ResultadoLista>({ ok: false, error })),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((resultado) => this.aplicarLista(resultado));
  }

  protected cambiarFiltro(event: Event): void {
    const valor = (event.target as HTMLSelectElement).value as FiltroEstado;
    if (ESTADOS.some((estado) => estado.valor === valor)) {
      this.filtro.set(valor);
    }
  }

  protected limpiarFiltro(): void {
    this.filtro.set('TODOS');
  }

  protected reintentar(): void {
    if (this.reintentando()) return;
    this.reintentando.set(true);
    this.recargar.next();
  }

  protected abrirDetalle(turno: TurnoMiniDTO): void {
    this.turnoSeleccionado.set(turno);
    this.detalle.set(null);
    this.detalleError.set(null);
    this.detalleCargando.set(true);
    this.detalleReintentando.set(false);
    this.sucursal.set(null);
    this.sucursalError.set(null);
    this.sucursalCargando.set(false);
    this.fotoSucursalFallida.set(null);
    this.cargarDetalle(turno.id);
  }

  protected cerrarDetalle(): void {
    this.cancelarConsultas();
    this.turnoSeleccionado.set(null);
    this.detalle.set(null);
    this.detalleError.set(null);
    this.detalleCargando.set(false);
    this.detalleReintentando.set(false);
    this.sucursal.set(null);
    this.sucursalError.set(null);
    this.sucursalCargando.set(false);
  }

  protected reintentarDetalle(): void {
    const turno = this.turnoSeleccionado();
    if (!turno || this.detalleCargando() || this.detalleReintentando()) return;
    this.detalleReintentando.set(true);
    this.cargarDetalle(turno.id, true);
  }

  protected reintentarSucursal(): void {
    const detalle = this.detalle();
    if (!detalle || this.sucursalCargando()) return;
    this.cargarSucursal(detalle, this.detalleRevision);
  }

  protected etiquetaEstado(estado: EstadoTurno | null | undefined): string {
    return estado ? ETIQUETAS_ESTADO[estado] : 'Sin estado';
  }

  protected claseEstado(estado: EstadoTurno | null | undefined): string {
    return estado ? estado.toLowerCase().replaceAll('_', '-') : 'desconocido';
  }

  protected formatearFecha(valor: string | null | undefined): string {
    const partes = this.partesFecha(valor);
    if (!partes) return '—';
    return `${this.dosDigitos(partes.dia)}/${this.dosDigitos(partes.mes)}/${partes.anio}`;
  }

  protected formatearFechaHora(valor: string | null | undefined): string {
    const partes = this.partesFecha(valor);
    if (!partes) return '—';
    return `${this.formatearFecha(valor)} · ${this.dosDigitos(partes.hora)}:${this.dosDigitos(partes.minuto)}`;
  }

  protected formatearPrecio(valor: number | string | null | undefined): string {
    if (valor === null || valor === undefined || valor === '') return 'A consultar';
    const numero = typeof valor === 'string' ? Number(valor.replace(',', '.')) : valor;
    return Number.isFinite(numero) ? this.formatoMoneda.format(numero) : 'A consultar';
  }

  protected ariaLabelTurno(turno: TurnoMiniDTO): string {
    return `${turno.nombreServicio}, ${this.formatearFechaHora(turno.fechaTurno)}, ${this.etiquetaEstado(turno.estadoTurno)}`;
  }

  protected onFotoSucursalError(foto: string): void {
    this.fotoSucursalFallida.set(foto);
  }

  private aplicarLista(resultado: ResultadoLista): void {
    if (!resultado.ok) {
      this.error.set(this.mensajeError(resultado.error, 'lista'));
      this.cargando.set(false);
      this.reintentando.set(false);
      return;
    }

    const ordenados = [...resultado.turnos].sort(
      (a, b) => this.timestamp(b.fechaTurno) - this.timestamp(a.fechaTurno),
    );
    this.turnos.set(ordenados);
    this.error.set(null);
    this.cargando.set(false);
    this.reintentando.set(false);
  }

  private cargarDetalle(id: number, reintento = false): void {
    this.cancelarConsultas();
    const revision = this.detalleRevision;

    if (!reintento) {
      this.detalleCargando.set(true);
      this.detalleError.set(null);
    }

    this.detalleSub = this.turnosApi
      .detallePropio(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (detalle) => {
          if (revision !== this.detalleRevision) return;
          this.detalle.set(detalle);
          this.detalleCargando.set(false);
          this.detalleReintentando.set(false);
          this.detalleError.set(null);
          this.cargarSucursal(detalle, revision);
        },
        error: (error: unknown) => {
          if (revision !== this.detalleRevision) return;
          this.detalleCargando.set(false);
          this.detalleReintentando.set(false);
          this.detalleError.set(this.mensajeError(error, 'detalle'));
        },
      });
  }

  private cargarSucursal(detalle: TurnoClienteDetalleDTO, revision: number): void {
    this.sucursalSub?.unsubscribe();
    this.sucursal.set(null);
    this.sucursalError.set(null);
    this.sucursalCargando.set(true);

    this.sucursalSub = this.buscarSucursal(detalle)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (sucursal) => {
          if (revision !== this.detalleRevision) return;
          this.sucursal.set(sucursal);
          this.sucursalCargando.set(false);
          if (!sucursal) {
            this.sucursalError.set('No pudimos identificar la sucursal de este turno.');
          }
        },
        error: (error: unknown) => {
          if (revision !== this.detalleRevision) return;
          this.sucursalCargando.set(false);
          this.sucursalError.set(this.mensajeError(error, 'sucursal'));
        },
      });
  }

  /**
   * El detalle del turno no incluye la sucursal. Se obtiene el nombre y la
   * categoría desde el servicio y después se verifica que la sucursal
   * candidata realmente ofrezca ese servicio antes de mostrarla.
   */
  private buscarSucursal(detalle: TurnoClienteDetalleDTO): Observable<SucursalMiniDTO | null> {
    return this.serviciosApi.obtenerPorId(detalle.servicio.id).pipe(
      switchMap((servicio) => {
        const nombre = servicio.nombreSucursal?.trim();
        if (!nombre) return of(null);

        return this.sucursalesApi.filtrar(servicio.categoriaSucursal ?? null, nombre, true).pipe(
          switchMap((candidatas) => {
            if (!candidatas.length) return of(null);

            const objetivo = this.normalizar(nombre);
            const exactas = candidatas.filter(
              (candidata) => this.normalizar(candidata.nombre) === objetivo,
            );
            const posibles = exactas.length ? exactas : candidatas;

            const verificaciones = posibles.map((candidata) =>
              this.serviciosApi.listarPorSucursal(candidata.id).pipe(
                map((servicios) =>
                  servicios.some((servicioSucursal) => servicioSucursal.id === detalle.servicio.id)
                    ? candidata
                    : null,
                ),
                catchError(() => of(null)),
              ),
            );

            return forkJoin(verificaciones).pipe(
              map(
                (resultados) =>
                  resultados.find(
                    (candidata): candidata is SucursalMiniDTO => candidata !== null,
                  ) ?? null,
              ),
            );
          }),
        );
      }),
    );
  }

  private mensajeError(error: unknown, contexto: ContextoError): string {
    const status =
      error instanceof HttpErrorResponse
        ? error.status
        : (error as { status?: number } | null)?.status;

    if (status === 0) {
      return 'No pudimos conectarnos. Revisá tu conexión e intentá nuevamente.';
    }
    if (status === 403) {
      return 'No tenés permisos para consultar esta información.';
    }
    if (status === 404) {
      return contexto === 'detalle'
        ? 'No encontramos el detalle de este turno.'
        : 'No encontramos la información solicitada.';
    }
    if (contexto === 'lista') {
      return 'No pudimos cargar tus turnos. Probá de nuevo en unos segundos.';
    }
    if (contexto === 'detalle') {
      return 'No pudimos cargar el detalle del turno. Probá de nuevo en unos segundos.';
    }
    return 'No pudimos cargar los datos de la sucursal. Probá de nuevo en unos segundos.';
  }

  private sumarMinutos(valor: string, minutos: number): string {
    const partes = this.partesFecha(valor);
    if (!partes) return '—';

    const duracion = Number.isFinite(minutos) ? Math.max(0, Math.trunc(minutos)) : 0;
    const fecha = new Date(
      partes.anio,
      partes.mes - 1,
      partes.dia,
      partes.hora,
      partes.minuto,
      partes.segundo,
    );
    fecha.setMinutes(fecha.getMinutes() + duracion);

    const dia = this.dosDigitos(fecha.getDate());
    const mes = this.dosDigitos(fecha.getMonth() + 1);
    const anio = fecha.getFullYear();
    const hora = this.dosDigitos(fecha.getHours());
    const minuto = this.dosDigitos(fecha.getMinutes());
    return `${dia}/${mes}/${anio} · ${hora}:${minuto}`;
  }

  private timestamp(valor: string): number {
    const partes = this.partesFecha(valor);
    if (partes) {
      return new Date(
        partes.anio,
        partes.mes - 1,
        partes.dia,
        partes.hora,
        partes.minuto,
        partes.segundo,
      ).getTime();
    }
    const fecha = Date.parse(valor);
    return Number.isNaN(fecha) ? 0 : fecha;
  }

  private partesFecha(valor: string | null | undefined): PartesFecha | null {
    if (!valor) return null;
    const coincidencia =
      /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(valor.trim());
    if (!coincidencia) return null;

    return {
      anio: Number(coincidencia[1]),
      mes: Number(coincidencia[2]),
      dia: Number(coincidencia[3]),
      hora: Number(coincidencia[4] ?? 0),
      minuto: Number(coincidencia[5] ?? 0),
      segundo: Number(coincidencia[6] ?? 0),
    };
  }

  private dosDigitos(valor: number): string {
    return String(valor).padStart(2, '0');
  }

  private normalizar(valor: string | null | undefined): string {
    return (valor ?? '')
      .trim()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase();
  }

  private cancelarConsultas(): void {
    this.detalleSub?.unsubscribe();
    this.sucursalSub?.unsubscribe();
    this.detalleSub = undefined;
    this.sucursalSub = undefined;
    this.detalleRevision++;
  }
}
