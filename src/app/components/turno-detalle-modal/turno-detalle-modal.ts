import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  EventEmitter,
  Input,
  Output,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';

import { DsButtonComponent } from '../../shared/ui/button/button.component';
import { DsModalComponent } from '../../shared/ui/misc/misc.component';
import { humanizarCategoria } from '../../models/solicitud-empleado';
import { SucursalDetalleDTO } from '../../models/sucursal';
import {
  EstadoTurno,
  TurnoEmpleadorDetalleDTO,
  TurnoMiniDTO,
} from '../../models/turno';
import { turnoService } from '../../services/turno-service';

const LIMITE_RESENIA = 220;

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

/**
 * Modal de detalle de un turno de sucursal.
 *
 * Reutiliza la estructura, estilos y lógica del detalle de US-TUR-03 para que
 * tanto el panel del empleador como la agenda del empleado muestren exactamente
 * la misma información. El componente padre solo aporta el turno seleccionado y
 * los datos de la sucursal; este componente resuelve el detalle, el reintento y
 * la expansión de la reseña.
 */
@Component({
  selector: 'app-turno-detalle-modal',
  imports: [DsButtonComponent, DsModalComponent, RouterLink],
  templateUrl: './turno-detalle-modal.html',
  styleUrl: './turno-detalle-modal.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TurnoDetalleModal {
  private readonly turnosApi = inject(turnoService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly formatoMoneda = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
  });

  private readonly turnoActual = signal<TurnoMiniDTO | null>(null);
  private detalleSub?: Subscription;
  private revision = 0;

  @Input()
  set turno(value: TurnoMiniDTO | null) {
    const anterior = this.turnoActual();
    this.turnoActual.set(value);

    if (!value) {
      this.limpiar();
      return;
    }

    if (value.id !== anterior?.id) {
      this.abrir(value);
    }
  }
  get turno(): TurnoMiniDTO | null {
    return this.turnoActual();
  }

  readonly sucursal = input<SucursalDetalleDTO | null>(null);
  readonly sucursalCargando = input(false);
  readonly sucursalError = input<string | null>(null);

  @Output() readonly close = new EventEmitter<void>();
  @Output() readonly reintentarSucursal = new EventEmitter<void>();

  protected readonly detalle = signal<TurnoEmpleadorDetalleDTO | null>(null);
  protected readonly detalleCargando = signal(false);
  protected readonly detalleError = signal<string | null>(null);
  protected readonly detalleReintentando = signal(false);
  private readonly fotoSucursalFallida = signal<string | null>(null);
  private readonly fotoEmpleadoFallida = signal<string | null>(null);

  protected readonly reseniaExpandida = signal(false);

  protected readonly detalleTitulo = computed(
    () =>
      this.detalle()?.servicio.nombre ??
      this.turnoActual()?.nombreServicio ??
      'Detalle del turno',
  );

  protected readonly detalleEstado = computed<EstadoTurno | null>(
    () =>
      this.detalle()?.estadoTurno ??
      this.turnoActual()?.estadoTurno ??
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

  protected cerrar(): void {
    this.limpiar();
    this.close.emit();
  }

  protected reintentarDetalle(): void {
    const turno = this.turnoActual();
    if (!turno || this.detalleCargando() || this.detalleReintentando()) return;
    this.detalleReintentando.set(true);
    this.cargarDetalle(turno.id, this.revision);
  }

  protected reintentarSucursalActual(): void {
    if (this.sucursalCargando()) return;
    this.reintentarSucursal.emit();
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

  protected onFotoSucursalError(foto: string): void {
    this.fotoSucursalFallida.set(foto);
  }

  protected onFotoEmpleadoError(foto: string): void {
    this.fotoEmpleadoFallida.set(foto);
  }

  private abrir(turno: TurnoMiniDTO): void {
    this.detalleSub?.unsubscribe();
    const revision = ++this.revision;

    this.detalle.set(null);
    this.detalleError.set(null);
    this.detalleCargando.set(true);
    this.detalleReintentando.set(false);
    this.reseniaExpandida.set(false);
    this.fotoEmpleadoFallida.set(null);

    this.cargarDetalle(turno.id, revision);
  }

  private limpiar(): void {
    this.cancelarDetalle();
    this.detalle.set(null);
    this.detalleError.set(null);
    this.detalleCargando.set(false);
    this.detalleReintentando.set(false);
    this.reseniaExpandida.set(false);
    this.fotoEmpleadoFallida.set(null);
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
          this.detalleError.set(this.mensajeError(error));
        },
      });
  }

  private mensajeError(error: unknown): string {
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
      return 'No encontramos el detalle de este turno.';
    }
    return 'No pudimos cargar el detalle del turno. Probá de nuevo en unos segundos.';
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

  private cancelarDetalle(): void {
    this.detalleSub?.unsubscribe();
    this.detalleSub = undefined;
    this.revision++;
  }
}
