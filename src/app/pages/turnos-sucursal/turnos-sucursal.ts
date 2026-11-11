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

import { DsButtonComponent } from '../../shared/ui/button/button.component';
import {
  DsModalComponent,
  DsSelectComponent,
} from '../../shared/ui/misc/misc.component';
import { humanizarCategoria } from '../../models/solicitud-empleado';
import { SucursalDetalleDTO } from '../../models/sucursal';
import {
  EstadoTurno,
  TurnoEmpleadorDetalleDTO,
  TurnoMiniDTO,
} from '../../models/turno';
import { sucursalService } from '../../services/sucursal-service';
import { turnoService } from '../../services/turno-service';

const ESTADO_INICIAL: EstadoTurno = 'CONFIRMADO';
const LIMITE_RESENIA = 220;

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

type ContextoError = 'lista' | 'detalle' | 'sucursal';

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
  imports: [DsButtonComponent, DsModalComponent, DsSelectComponent, RouterLink],
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
  private readonly formatoMoneda = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
  });

  private readonly sucursalId = Number(
    this.route.snapshot.paramMap.get('sucursalId') ?? '',
  );
  private readonly sucursalValida =
    Number.isInteger(this.sucursalId) && this.sucursalId > 0;

  private detalleSub?: Subscription;
  private sucursalSub?: Subscription;
  private revision = 0;

  protected readonly estados = ESTADOS;
  protected readonly estado = signal<EstadoTurno>(ESTADO_INICIAL);
  protected readonly turnos = signal<readonly TurnoMiniDTO[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly reintentando = signal(false);

  protected readonly sucursal = signal<SucursalDetalleDTO | null>(null);
  protected readonly sucursalCargando = signal(true);
  protected readonly sucursalError = signal<string | null>(null);
  private readonly fotoSucursalFallida = signal<string | null>(null);

  protected readonly turnoSeleccionado = signal<TurnoMiniDTO | null>(null);
  protected readonly detalle = signal<TurnoEmpleadorDetalleDTO | null>(null);
  protected readonly detalleCargando = signal(false);
  protected readonly detalleError = signal<string | null>(null);
  protected readonly detalleReintentando = signal(false);
  private readonly fotoEmpleadoFallida = signal<string | null>(null);

  protected readonly reseniaExpandida = signal(false);

  protected readonly nombreSucursal = computed(
    () => this.sucursal()?.nombre ?? `Sucursal #${this.sucursalId}`,
  );

  protected readonly etiquetaEstadoSeleccionado = computed(
    () => ETIQUETAS_ESTADO[this.estado()],
  );

  protected readonly detalleTitulo = computed(
    () =>
      this.detalle()?.servicio.nombre ??
      this.turnoSeleccionado()?.nombreServicio ??
      'Detalle del turno',
  );

  protected readonly detalleEstado = computed<EstadoTurno | null>(
    () =>
      this.detalle()?.estadoTurno ??
      this.turnoSeleccionado()?.estadoTurno ??
      null,
  );

  protected readonly finDetalle = computed(() => {
    const detalle = this.detalle();
    return detalle
      ? this.sumarMinutos(detalle.fechaTurno, detalle.servicio.duracion)
      : '—';
  });

  protected readonly fotoSucursal = computed(() => {
    const foto = this.sucursal()?.fotoPerfil?.trim();
    return foto && foto !== this.fotoSucursalFallida() ? foto : null;
  });

  protected readonly categoriaSucursal = computed(() =>
    humanizarCategoria(this.sucursal()?.categoria),
  );

  protected readonly puntuacionSucursal = computed(
    () => this.sucursal()?.puntuacion ?? 0,
  );

  protected readonly cantidadReseniasSucursal = computed(
    () => this.sucursal()?.cantidadPuntuaciones ?? 0,
  );

  protected readonly textoReseniasSucursal = computed(() =>
    this.cantidadReseniasSucursal() === 1
      ? '1 reseña'
      : `${this.cantidadReseniasSucursal()} reseñas`,
  );

  protected readonly abejasSucursal = computed(() => {
    const puntuacion = Math.round(this.puntuacionSucursal());
    return [1, 2, 3, 4, 5].map((posicion) => posicion <= puntuacion);
  });

  protected readonly fotoEmpleado = computed(() => {
    const foto = this.detalle()?.empleado.urlFotoPerfil?.trim();
    return foto && foto !== this.fotoEmpleadoFallida() ? foto : null;
  });

  protected readonly inicialesEmpleado = computed(() => {
    const empleado = this.detalle()?.empleado;
    const iniciales = [empleado?.nombre, empleado?.apellido]
      .map((parte) => parte?.trim().charAt(0) ?? '')
      .join('')
      .toUpperCase();
    return iniciales || '👤';
  });

  protected readonly resenia = computed(() => this.detalle()?.resenia ?? null);
  protected readonly comentarioResenia = computed(
    () => this.resenia()?.comentario?.trim() ?? '',
  );
  protected readonly reseniaLarga = computed(
    () => this.comentarioResenia().length > LIMITE_RESENIA,
  );
  protected readonly comentarioVisible = computed(() => {
    const comentario = this.comentarioResenia();
    if (!comentario) return '';
    if (!this.reseniaLarga() || this.reseniaExpandida()) return comentario;
    return `${comentario.slice(0, LIMITE_RESENIA).trimEnd()}…`;
  });
  protected readonly puntuacionResenia = computed(
    () => this.resenia()?.puntuacion ?? null,
  );
  protected readonly abejasResenia = computed(() => {
    const puntuacion = this.resenia()?.puntuacion ?? 0;
    return [1, 2, 3, 4, 5].map((posicion) => posicion <= puntuacion);
  });

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
    this.detalleSub?.unsubscribe();
    const revision = ++this.revision;

    this.turnoSeleccionado.set(turno);
    this.detalle.set(null);
    this.detalleError.set(null);
    this.detalleCargando.set(true);
    this.detalleReintentando.set(false);
    this.reseniaExpandida.set(false);
    this.fotoEmpleadoFallida.set(null);

    this.cargarDetalle(turno.id, revision);
  }

  protected cerrarDetalle(): void {
    this.cancelarDetalle();
    this.turnoSeleccionado.set(null);
    this.detalle.set(null);
    this.detalleError.set(null);
    this.detalleCargando.set(false);
    this.detalleReintentando.set(false);
    this.reseniaExpandida.set(false);
    this.fotoEmpleadoFallida.set(null);
  }

  protected reintentarDetalle(): void {
    const turno = this.turnoSeleccionado();
    if (!turno || this.detalleCargando() || this.detalleReintentando()) return;
    this.detalleReintentando.set(true);
    this.cargarDetalle(turno.id, this.revision);
  }

  protected alternarResenia(): void {
    this.reseniaExpandida.update((expandida) => !expandida);
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

  protected onFotoEmpleadoError(foto: string): void {
    this.fotoEmpleadoFallida.set(foto);
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

  private cargarDetalle(id: number, revision: number): void {
    this.detalleSub?.unsubscribe();
    this.detalleError.set(null);

    this.detalleSub = this.turnosApi
      .detalleDeSucursal(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (detalle) => {
          if (revision !== this.revision) return;
          this.detalle.set(detalle);
          this.detalleCargando.set(false);
          this.detalleReintentando.set(false);
          this.detalleError.set(null);
          this.reseniaExpandida.set(false);
        },
        error: (error: unknown) => {
          if (revision !== this.revision) return;
          this.detalleCargando.set(false);
          this.detalleReintentando.set(false);
          this.detalleError.set(this.mensajeError(error, 'detalle'));
        },
      });
  }

  private cargarSucursal(): void {
    if (!this.sucursalValida) return;

    this.sucursalSub?.unsubscribe();
    this.sucursalError.set(null);
    this.sucursalCargando.set(true);
    this.fotoSucursalFallida.set(null);

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
      if (contexto === 'detalle') {
        return 'No encontramos el detalle de este turno.';
      }
      if (contexto === 'sucursal') {
        return 'No encontramos la sucursal solicitada.';
      }
      return 'No encontramos la información solicitada.';
    }
    if (contexto === 'lista') {
      return 'No pudimos cargar los turnos de la sucursal. Probá de nuevo en unos segundos.';
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

  private esEstadoValido(valor: string): valor is EstadoTurno {
    return ESTADOS.some((opcion) => opcion.valor === valor);
  }

  private cancelarDetalle(): void {
    this.detalleSub?.unsubscribe();
    this.detalleSub = undefined;
    this.revision++;
  }
}
