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
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  Subject,
  Subscription,
  catchError,
  map,
  of,
  startWith,
  switchMap,
} from 'rxjs';

import { TurnoDetalleModal } from '../../components/turno-detalle-modal/turno-detalle-modal';
import { DsButtonComponent } from '../../shared/ui/button/button.component';
import { DsSelectComponent } from '../../shared/ui/misc/misc.component';
import { SucursalDetalleDTO } from '../../models/sucursal';
import { EstadoTurno, TurnoMiniDTO } from '../../models/turno';
import { sucursalService } from '../../services/sucursal-service';
import { turnoService } from '../../services/turno-service';

const ESTADO_INICIAL: EstadoTurno = 'CONFIRMADO';

type ResultadoLista =
  | {
      readonly ok: true;
      readonly estado: EstadoTurno;
      readonly turnos: readonly TurnoMiniDTO[];
    }
  | {
      readonly ok: false;
      readonly estado: EstadoTurno;
      readonly error: unknown;
    };

type ContextoError = 'lista' | 'sucursal';

interface OpcionEstado {
  readonly valor: EstadoTurno;
  readonly etiqueta: string;
}

const ESTADOS: readonly OpcionEstado[] = [
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
  selector: 'app-turnos-sucursal',
  imports: [DsButtonComponent, DsSelectComponent, RouterLink, TurnoDetalleModal],
  templateUrl: './turnos-sucursal.html',
  styleUrl: './turnos-sucursal.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TurnosSucursal {
  private readonly turnosApi = inject(turnoService);
  private readonly sucursalesApi = inject(sucursalService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly recargar = new Subject<EstadoTurno>();

  private readonly sucursalId = Number(
    this.route.snapshot.paramMap.get('sucursalId') ?? '',
  );
  private readonly sucursalValida =
    Number.isInteger(this.sucursalId) && this.sucursalId > 0;

  private sucursalSub?: Subscription;

  protected readonly estados = ESTADOS;
  protected readonly estado = signal<EstadoTurno>(ESTADO_INICIAL);
  protected readonly turnos = signal<readonly TurnoMiniDTO[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly reintentando = signal(false);

  protected readonly sucursal = signal<SucursalDetalleDTO | null>(null);
  protected readonly sucursalCargando = signal(true);
  protected readonly sucursalError = signal<string | null>(null);

  protected readonly turnoSeleccionado = signal<TurnoMiniDTO | null>(null);

  protected readonly nombreSucursal = computed(
    () => this.sucursal()?.nombre ?? `Sucursal #${this.sucursalId}`,
  );

  protected readonly etiquetaEstadoSeleccionado = computed(
    () => ETIQUETAS_ESTADO[this.estado()],
  );

  constructor() {
    if (!this.sucursalValida) {
      this.cargando.set(false);
      this.sucursalCargando.set(false);
      this.error.set('No pudimos identificar la sucursal solicitada.');
      return;
    }

    this.recargar
      .pipe(
        startWith(ESTADO_INICIAL),
        switchMap((estado) => {
          this.cargando.set(this.turnos().length === 0 && !this.error());
          return this.turnosApi.turnosDeSucursal(this.sucursalId, estado).pipe(
            map(
              (turnos): ResultadoLista => ({ ok: true, estado, turnos }),
            ),
            catchError((error: unknown) =>
              of<ResultadoLista>({ ok: false, estado, error }),
            ),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((resultado) => this.aplicarLista(resultado));

    this.cargarSucursal();
  }

  protected cambiarEstado(event: Event): void {
    const valor = (event.target as HTMLSelectElement).value;
    if (!this.esEstadoValido(valor) || valor === this.estado()) return;

    this.estado.set(valor);
    this.turnos.set([]);
    this.error.set(null);
    this.cargando.set(true);
    this.reintentando.set(false);
    this.recargar.next(valor);
  }

  protected reintentar(): void {
    if (this.reintentando() || this.cargando()) return;
    this.reintentando.set(true);
    this.recargar.next(this.estado());
  }

  protected reintentarSucursal(): void {
    if (this.sucursalCargando()) return;
    this.cargarSucursal();
  }

  protected abrirDetalle(turno: TurnoMiniDTO): void {
    this.turnoSeleccionado.set(turno);
  }

  protected cerrarDetalle(): void {
    this.turnoSeleccionado.set(null);
  }

  protected etiquetaEstado(estado: EstadoTurno | null | undefined): string {
    return estado ? ETIQUETAS_ESTADO[estado] : 'Sin estado';
  }

  protected claseEstado(estado: EstadoTurno | null | undefined): string {
    return estado ? estado.toLowerCase().replaceAll('_', '-') : 'desconocido';
  }

  protected formatearFechaHora(valor: string | null | undefined): string {
    const partes = this.partesFecha(valor);
    if (!partes) return '—';
    return `${this.dosDigitos(partes.dia)}/${this.dosDigitos(partes.mes)}/${partes.anio} · ${this.dosDigitos(partes.hora)}:${this.dosDigitos(partes.minuto)}`;
  }

  protected ariaLabelTurno(turno: TurnoMiniDTO): string {
    return `${turno.nombreServicio}, ${this.formatearFechaHora(turno.fechaTurno)}, ${this.etiquetaEstado(turno.estadoTurno)}`;
  }

  private aplicarLista(resultado: ResultadoLista): void {
    if (resultado.estado !== this.estado()) return;

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

  private cargarSucursal(): void {
    if (!this.sucursalValida) return;

    this.sucursalSub?.unsubscribe();
    this.sucursalError.set(null);
    this.sucursalCargando.set(true);

    this.sucursalSub = this.sucursalesApi
      .obtenerPorId(this.sucursalId, true)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (sucursal) => {
          this.sucursal.set(sucursal);
          this.sucursalCargando.set(false);
        },
        error: (error: unknown) => {
          this.sucursalCargando.set(false);
          this.sucursalError.set(this.mensajeError(error, 'sucursal'));
        },
      });
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
      return contexto === 'lista'
        ? 'No tenés permisos para consultar los turnos de esta sucursal.'
        : 'No tenés permisos para consultar esta información.';
    }
    if (status === 404) {
      if (contexto === 'sucursal') {
        return 'No encontramos la sucursal solicitada.';
      }
      return 'No encontramos la información solicitada.';
    }
    if (contexto === 'lista') {
      return 'No pudimos cargar los turnos de la sucursal. Probá de nuevo en unos segundos.';
    }
    return 'No pudimos cargar los datos de la sucursal. Probá de nuevo en unos segundos.';
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

  private esEstadoValido(valor: string): valor is EstadoTurno {
    return ESTADOS.some((opcion) => opcion.valor === valor);
  }
}
