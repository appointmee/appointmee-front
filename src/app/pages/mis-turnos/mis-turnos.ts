import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  Observable,
  Subject,
  Subscription,
  catchError,
  finalize,
  firstValueFrom,
  forkJoin,
  map,
  of,
  startWith,
  switchMap,
} from 'rxjs';

import { DsButtonComponent } from '../../shared/ui/button/button.component';
import {
  DsModalComponent,
  DsPaginationComponent,
  DsSelectComponent,
} from '../../shared/ui/misc/misc.component';
import {
  MENSAJE_EMPLEADO_DESVINCULADO,
  MENSAJE_SUCURSAL_DE_BAJA,
  EstadoTurno,
  PaginaTurnosDTO,
  TurnoClienteDetalleDTO,
  TurnoMiniDTO,
} from '../../models/turno';
import { SucursalMiniDTO } from '../../models/sucursal';
import { pagoService } from '../../services/pago-service';
import { reseniaService } from '../../services/resenia-service';
import { servicioService } from '../../services/servicio-service';
import { sucursalService } from '../../services/sucursal-service';
import { turnoService } from '../../services/turno-service';

type FiltroEstado = EstadoTurno | 'TODOS';

type ResultadoLista =
  | { readonly ok: true; readonly pagina: PaginaTurnosDTO; readonly paginaSolicitada: number }
  | { readonly ok: false; readonly paginaSolicitada: number; readonly error: unknown };

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

/** La reseña del turno se publica con una puntuación de 1 a 5 abejas. */
const PUNTUACIONES = [1, 2, 3, 4, 5] as const;
const COMENTARIO_MINIMO = 9;
const COMENTARIO_MAXIMO = 400;

const ERRORES_PUNTUACION = {
  obligatoria: 'Elegí una puntuación de 1 a 5 abejas.',
} as const;

const ERRORES_COMENTARIO = {
  minimo: `Si escribís un comentario, debe tener al menos ${COMENTARIO_MINIMO} caracteres.`,
} as const;

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
  imports: [
    DsButtonComponent,
    DsModalComponent,
    DsPaginationComponent,
    DsSelectComponent,
    RouterLink,
  ],
  templateUrl: './mis-turnos.html',
  styleUrl: './mis-turnos.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MisTurnos {
  private readonly turnosApi = inject(turnoService);
  private readonly serviciosApi = inject(servicioService);
  private readonly sucursalesApi = inject(sucursalService);
  private readonly reseniasApi = inject(reseniaService);
  private readonly pagosApi = inject(pagoService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly turnoIdDelEnlace = this.parseId(
    this.route.snapshot.queryParamMap.get('turnoId'),
  );
  private enlaceAbierto = false;
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly recargar = new Subject<number>();
  private readonly formatoMoneda = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
  });

  private detalleSub?: Subscription;
  private sucursalSub?: Subscription;
  private pagoSeguimientoSub?: Subscription;
  private pagoSeguimientoTimer?: ReturnType<typeof setTimeout>;
  private detalleRevision = 0;
  private pagoSeguimientoRevision = 0;

  protected readonly estados = ESTADOS;
  protected readonly filtro = signal<FiltroEstado>('TODOS');
  protected readonly turnos = signal<readonly TurnoMiniDTO[]>([]);
  /** Página 0-based solicitada al backend. ds-pagination trabaja en 1-based. */
  protected readonly pagina = signal(0);
  protected readonly totalPaginas = signal(0);
  protected readonly totalElementos = signal(0);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly reintentando = signal(false);
  protected readonly mostrarPaginacion = computed(() => this.totalPaginas() > 1);

  protected readonly turnoSeleccionado = signal<TurnoMiniDTO | null>(null);
  protected readonly detalle = signal<TurnoClienteDetalleDTO | null>(null);
  protected readonly detalleCargando = signal(false);
  protected readonly detalleError = signal<string | null>(null);
  protected readonly detalleReintentando = signal(false);

  protected readonly sucursal = signal<SucursalMiniDTO | null>(null);
  protected readonly sucursalCargando = signal(false);
  protected readonly sucursalError = signal<string | null>(null);
  private readonly fotoSucursalFallida = signal<string | null>(null);

  protected readonly mensajeEmpleadoDesvinculado = MENSAJE_EMPLEADO_DESVINCULADO;
  protected readonly mensajeSucursalDeBaja = MENSAJE_SUCURSAL_DE_BAJA;

  /** Datos históricos del backend, disponibles aunque la sucursal esté de baja. */
  protected readonly sucursalVisible = computed(() => {
    const historica = this.detalle()?.sucursal ?? null;
    const actual = this.sucursal();
    if (!historica && !actual) return null;

    return {
      id: historica?.id ?? actual?.id ?? null,
      nombre: historica?.nombre ?? actual?.nombre ?? '',
      direccion: historica?.direccion ?? null,
      telefono: historica?.telefono ?? null,
      categoria: historica?.categoria ?? actual?.categoria ?? null,
      fotoPerfil: historica?.fotoPerfil ?? actual?.fotoPerfil ?? null,
      cantidadPuntuaciones: actual?.cantidadPuntuaciones ?? 0,
      tieneDatosActuales: actual !== null,
    };
  });

  protected readonly sucursalActiva = computed(
    () => this.detalle()?.sucursalActiva ?? true,
  );

  /** Una baja global y una desvinculación comparten el mismo aviso al cliente. */
  protected readonly mostrarAvisoEmpleado = computed(() => {
    const detalle = this.detalle();
    if (!detalle) return false;
    return (
      (detalle.empleadoActivo ?? true) === false ||
      (detalle.empleadoPerteneceASucursal ?? true) === false
    );
  });

  protected readonly pagandoTurnoId = signal<number | null>(null);
  protected readonly pagoError = signal<string | null>(null);

  protected readonly puntuaciones = PUNTUACIONES;
  protected readonly reseniaAbierta = signal(false);
  protected readonly reseniaConfirmacion = signal(false);
  protected readonly reseniaPuntuacion = signal<number | null>(null);
  protected readonly reseniaComentario = signal('');
  protected readonly reseniaIntentada = signal(false);
  protected readonly reseniaEnviando = signal(false);
  protected readonly reseniaError = signal<string | null>(null);
  protected readonly reseniaExito = signal<string | null>(null);
  protected readonly comentarioMinimo = COMENTARIO_MINIMO;
  protected readonly comentarioMaximo = COMENTARIO_MAXIMO;

  protected readonly turnosFiltrados = computed(() => {
    const filtro = this.filtro();
    return filtro === 'TODOS'
      ? this.turnos()
      : this.turnos().filter((turno) => turno.estadoTurno === filtro);
  });

  /** El filtro es local: sólo se aplica a los turnos de la página cargada. */
  protected readonly resumenFiltro = computed(() => {
    if (this.filtro() === 'TODOS') return null;
    return `${this.turnosFiltrados().length} de ${this.turnos().length} turnos de esta página coinciden con el filtro.`;
  });

  protected readonly contadorAriaLabel = computed(() => {
    const total = this.totalElementos();
    const base = total === 1 ? '1 turno en total' : `${total} turnos en total`;
    const resumen = this.resumenFiltro();
    return resumen ? `${base}. ${resumen}` : base;
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
    const foto = this.sucursalVisible()?.fotoPerfil?.trim();
    return foto && foto !== this.fotoSucursalFallida() ? foto : null;
  });

  protected readonly puntuacionSucursal = computed(() => this.sucursal()?.puntuacion ?? 0);

  protected readonly abejasSucursal = computed(() => {
    const puntuacion = Math.round(this.puntuacionSucursal());
    return [1, 2, 3, 4, 5].map((posicion) => posicion <= puntuacion);
  });

  protected readonly reseniaDetalle = computed(() => this.detalle()?.resenia ?? null);

  /** Un turno ya está reseñado si el listado o el detalle traen una puntuación. */
  protected readonly detalleReseniado = computed(() => {
    const turno = this.turnoSeleccionado();
    return this.reseniaDetalle() !== null || (turno?.puntuacion ?? null) !== null;
  });

  protected readonly puedeReseniarDetalle = computed(
    () => this.detalleEstado() === 'REALIZADO' && !this.detalleReseniado(),
  );

  protected readonly abejasReseniaDetalle = computed(() => {
    const puntuacion = this.reseniaDetalle()?.puntuacion ?? 0;
    return PUNTUACIONES.map((posicion) => posicion <= puntuacion);
  });

  protected readonly comentarioCaracteres = computed(
    () => this.reseniaComentario().length,
  );

  protected readonly errorPuntuacion = computed(() =>
    this.reseniaIntentada() && this.reseniaPuntuacion() === null
      ? ERRORES_PUNTUACION.obligatoria
      : null,
  );

  protected readonly errorComentario = computed(() => {
    if (!this.reseniaIntentada()) return null;
    const texto = this.reseniaComentario().trim();
    return texto.length > 0 && texto.length < COMENTARIO_MINIMO
      ? ERRORES_COMENTARIO.minimo
      : null;
  });

  protected readonly reseniaValida = computed(() => {
    const texto = this.reseniaComentario().trim();
    return (
      this.reseniaPuntuacion() !== null &&
      (texto.length === 0 || texto.length >= COMENTARIO_MINIMO)
    );
  });

  protected readonly reseniaComentarioPreview = computed(
    () => this.reseniaComentario().trim(),
  );

  constructor() {
    this.recargar
      .pipe(
        startWith(0),
        switchMap((paginaSolicitada) => {
          this.cargando.set(this.turnos().length === 0 && !this.error());
          return this.turnosApi.propiosPaginado(paginaSolicitada).pipe(
            map(
              (pagina): ResultadoLista => ({
                ok: true,
                pagina,
                paginaSolicitada,
              }),
            ),
            catchError((error: unknown) =>
              of<ResultadoLista>({ ok: false, paginaSolicitada, error }),
            ),
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
    this.recargar.next(this.pagina());
  }

  /** ds-pagination emite páginas 1-based; el backend espera 0-based. */
  protected cambiarPagina(pagina1based: number): void {
    const destino = pagina1based - 1;
    if (
      !Number.isInteger(destino) ||
      destino < 0 ||
      destino >= this.totalPaginas() ||
      destino === this.pagina()
    ) {
      return;
    }

    this.pagina.set(destino);
    this.turnos.set([]);
    this.error.set(null);
    this.cargando.set(true);
    this.recargar.next(destino);
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
    this.cancelarSeguimientoPago();
    this.turnoSeleccionado.set(null);
    this.detalle.set(null);
    this.detalleError.set(null);
    this.detalleCargando.set(false);
    this.detalleReintentando.set(false);
    this.sucursal.set(null);
    this.sucursalError.set(null);
    this.sucursalCargando.set(false);
    this.pagandoTurnoId.set(null);
    this.pagoError.set(null);
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

  protected async pagarTurnoPendiente(): Promise<void> {
    const turno = this.turnoSeleccionado();
    const detalle = this.detalle();
    if (!turno || !detalle || detalle.estadoTurno !== 'PENDIENTE') return;
    if (this.pagandoTurnoId() !== null) return;

    this.pagandoTurnoId.set(turno.id);
    this.pagoError.set(null);

    try {
      const url = await firstValueFrom(this.pagosApi.crearPreferencia(turno.id));
      if (!url?.trim()) {
        throw new Error('No pudimos obtener el enlace de pago.');
      }

      this.guardarContextoPago(turno.id);
      window.open(url, '_blank', 'noopener,noreferrer');
      this.iniciarSeguimientoPago(turno.id);
    } catch (error) {
      this.pagoError.set(this.mensajeErrorPago(error));
    } finally {
      this.pagandoTurnoId.set(null);
    }
  }

  /** Solo los turnos realizados y todavía sin reseña se pueden reseñar. */
  protected puedeReseniar(turno: TurnoMiniDTO | null | undefined): boolean {
    return turno?.estadoTurno === 'REALIZADO' && turno.puntuacion === null;
  }

  protected turnoReseniado(turno: TurnoMiniDTO | null | undefined): boolean {
    return turno?.estadoTurno === 'REALIZADO' && turno.puntuacion !== null;
  }

  protected abrirResenia(): void {
    const turno = this.turnoSeleccionado();
    if (
      !turno ||
      !this.puedeReseniar(turno) ||
      !this.puedeReseniarDetalle() ||
      this.detalle()?.resenia
    )
      return;

    this.reseniaPuntuacion.set(null);
    this.reseniaComentario.set('');
    this.reseniaIntentada.set(false);
    this.reseniaEnviando.set(false);
    this.reseniaError.set(null);
    this.reseniaConfirmacion.set(false);
    this.reseniaAbierta.set(true);
  }

  protected cancelarResenia(): void {
    if (this.reseniaEnviando()) return;
    this.cerrarResenia();
    this.cerrarDetalle();
  }

  protected abrirConfirmacionResenia(): void {
    if (this.reseniaEnviando()) return;

    this.reseniaIntentada.set(true);
    this.reseniaError.set(null);

    if (!this.reseniaValida()) {
      this.enfocarPrimerCampoInvalido();
      return;
    }

    this.reseniaConfirmacion.set(true);
  }

  /** Vuelve al formulario conservando la puntuación y el comentario elegidos. */
  protected volverAFormularioResenia(): void {
    if (this.reseniaEnviando()) return;
    this.reseniaError.set(null);
    this.reseniaConfirmacion.set(false);
  }

  protected confirmarPublicacionResenia(): void {
    const turno = this.turnoSeleccionado();
    const puntuacion = this.reseniaPuntuacion();
    if (!turno || puntuacion === null || this.reseniaEnviando()) return;

    const comentario = this.reseniaComentario().trim();
    this.reseniaEnviando.set(true);
    this.reseniaError.set(null);

    this.reseniasApi
      .crearParaTurno(turno.id, {
        puntuacion,
        comentario: comentario === '' ? null : comentario,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (respuesta) => {
          this.reseniaEnviando.set(false);
          this.reseniaConfirmacion.set(false);
          this.reseniaAbierta.set(false);
          this.reseniaIntentada.set(false);
          this.reseniaPuntuacion.set(null);
          this.reseniaComentario.set('');
          this.turnos.update((turnos) =>
            turnos.map((item) =>
              item.id === turno.id ? { ...item, puntuacion } : item,
            ),
          );
          this.reseniaExito.set(
            typeof respuesta === 'string' && respuesta.trim() !== ''
              ? respuesta
              : 'Reseña publicada correctamente.',
          );
          this.cerrarDetalle();
        },
        error: (error: unknown) => {
          this.reseniaEnviando.set(false);
          this.reseniaError.set(this.mensajeErrorResenia(error));
        },
      });
  }

  protected enfocarPuntuacion(): void {
    this.host.nativeElement
      .querySelector<HTMLInputElement>('input[name="resenia-puntuacion"]')
      ?.focus();
  }

  protected enfocarComentario(): void {
    this.host.nativeElement
      .querySelector<HTMLTextAreaElement>('#resenia-comentario')
      ?.focus();
  }

  protected seleccionarPuntuacion(valor: number): void {
    if (this.reseniaEnviando()) return;
    this.reseniaPuntuacion.set(valor);
  }

  protected actualizarComentario(event: Event): void {
    const valor = (event.target as HTMLTextAreaElement).value;
    this.reseniaComentario.set(valor.slice(0, COMENTARIO_MAXIMO));
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
    const reseniado = this.turnoReseniado(turno) ? ', reseñado' : '';
    return `${turno.nombreServicio}, ${this.formatearFechaHora(turno.fechaTurno)}, ${this.etiquetaEstado(turno.estadoTurno)}${reseniado}`;
  }

  protected onFotoSucursalError(foto: string): void {
    this.fotoSucursalFallida.set(foto);
  }

  private aplicarLista(resultado: ResultadoLista): void {
    if (resultado.paginaSolicitada !== this.pagina()) return;

    if (!resultado.ok) {
      this.error.set(this.mensajeError(resultado.error, 'lista'));
      this.cargando.set(false);
      this.reintentando.set(false);
      return;
    }

    const { content, totalElements, totalPages } = resultado.pagina;
    const ordenados = [...content].sort(
      (a, b) => this.timestamp(b.fechaTurno) - this.timestamp(a.fechaTurno),
    );
    this.turnos.set(ordenados);
    this.totalElementos.set(totalElements);
    this.totalPaginas.set(totalPages);
    this.error.set(null);
    this.cargando.set(false);
    this.reintentando.set(false);

    // Deep-link desde el centro de notificaciones: ?turnoId= abre el detalle
    // del turno cuando está entre los turnos de la página cargada.
    const objetivo = this.turnoIdDelEnlace;
    if (!this.enlaceAbierto && objetivo !== null) {
      const turno = ordenados.find((item) => item.id === objetivo);
      if (turno) {
        this.enlaceAbierto = true;
        this.abrirDetalle(turno);
      }
    }
  }

  private parseId(valor: string | null): number | null {
    if (!valor) return null;
    const id = Number(valor);
    return Number.isInteger(id) && id > 0 ? id : null;
  }

  private cargarDetalle(id: number, reintento = false): void {
    this.cancelarConsultas();
    this.cancelarSeguimientoPago();
    this.pagoError.set(null);
    this.pagandoTurnoId.set(null);
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

    // Una sucursal dada de baja no aparece en el filtrado activo: se muestran
    // los datos históricos del detalle y se evita una consulta innecesaria.
    if (detalle.sucursalActiva === false) {
      this.sucursalCargando.set(false);
      return;
    }

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
   * El detalle actualizado incluye los datos históricos de la sucursal. Esta
   * búsqueda solo se usa para completar calificación y reseñas de una sucursal
   * que sigue activa, verificando que ofrezca el servicio del turno.
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

  private mensajeErrorResenia(error: unknown): string {
    const status =
      error instanceof HttpErrorResponse
        ? error.status
        : (error as { status?: number } | null)?.status;
    const cuerpo =
      error instanceof HttpErrorResponse
        ? error.error
        : (error as { error?: unknown } | null)?.error;

    if (typeof cuerpo === 'string' && cuerpo.trim() !== '') return cuerpo;

    const cuerpoObjeto =
      cuerpo && typeof cuerpo === 'object'
        ? (cuerpo as { mensaje?: unknown; message?: unknown })
        : null;
    const mensajeBackend =
      typeof cuerpoObjeto?.mensaje === 'string'
        ? cuerpoObjeto.mensaje
        : typeof cuerpoObjeto?.message === 'string'
          ? cuerpoObjeto.message
          : '';
    if (mensajeBackend.trim() !== '') return mensajeBackend;

    if (status === 0) {
      return 'No pudimos conectarnos. Revisá tu conexión e intentá nuevamente.';
    }
    if (status === 403) {
      return 'No tenés permisos para publicar esta reseña.';
    }
    if (status === 404) {
      return 'No encontramos el turno para publicar la reseña.';
    }
    if (status === 409) {
      return 'El turno ya fue reseñado o todavía no está realizado.';
    }
    if (status === 400) {
      return 'Revisá la puntuación y el comentario ingresados.';
    }
    return 'No pudimos publicar tu reseña. Probá de nuevo en unos segundos.';
  }

  private mensajeErrorPago(error: unknown): string {
    const status =
      error instanceof HttpErrorResponse
        ? error.status
        : (error as { status?: number } | null)?.status;
    const cuerpo =
      error instanceof HttpErrorResponse
        ? error.error
        : (error as { error?: unknown } | null)?.error;

    if (typeof cuerpo === 'string' && cuerpo.trim() !== '') return cuerpo;

    const cuerpoObjeto =
      cuerpo && typeof cuerpo === 'object'
        ? (cuerpo as { mensaje?: unknown; message?: unknown })
        : null;
    const mensajeBackend =
      typeof cuerpoObjeto?.mensaje === 'string'
        ? cuerpoObjeto.mensaje
        : typeof cuerpoObjeto?.message === 'string'
          ? cuerpoObjeto.message
          : '';
    if (mensajeBackend.trim() !== '') return mensajeBackend;

    if (status === 0) {
      return 'No pudimos conectarnos. Revisá tu conexión e intentá nuevamente.';
    }
    if (status === 401) {
      return 'Tu sesión expiró. Iniciá sesión nuevamente.';
    }
    if (status === 403) {
      return 'No tenés permisos para pagar este turno.';
    }
    if (status === 404) {
      return 'No encontramos el turno para iniciar el pago.';
    }
    if (status === 409) {
      return 'Este turno ya no está disponible para pagar.';
    }
    return 'No pudimos iniciar el pago. Probá de nuevo en unos segundos.';
  }

  private guardarContextoPago(turnoId: number): void {
    try {
      const contexto = {
        turnoId,
        sucursalId: this.sucursal()?.id ?? null,
      };
      sessionStorage.setItem('appointmee.pago', JSON.stringify(contexto));
    } catch {
      // Ignorar errores de almacenamiento; no deben interrumpir el pago.
    }
  }

  private iniciarSeguimientoPago(turnoId: number): void {
    this.cancelarSeguimientoPago();
    const revision = ++this.pagoSeguimientoRevision;
    const consultar = (intentosRestantes: number): void => {
      if (revision !== this.pagoSeguimientoRevision) return;
      if (this.turnoSeleccionado()?.id !== turnoId) return;
      const estadoActual = this.detalleEstado();
      if (estadoActual && estadoActual !== 'PENDIENTE') return;
      if (intentosRestantes <= 0) return;

      this.pagoSeguimientoTimer = setTimeout(() => {
        if (revision !== this.pagoSeguimientoRevision) return;
        if (this.turnoSeleccionado()?.id !== turnoId) return;
        this.pagoSeguimientoSub?.unsubscribe();
        this.pagoSeguimientoSub = this.turnosApi
          .detallePropio(turnoId)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (detalle) => {
              if (revision !== this.pagoSeguimientoRevision) return;
              if (this.turnoSeleccionado()?.id !== turnoId) return;
              if (detalle.estadoTurno !== 'PENDIENTE') {
                this.actualizarTurnoIndividual(turnoId, detalle);
                this.cancelarSeguimientoPago();
                return;
              }
              consultar(intentosRestantes - 1);
            },
            error: () => {
              if (revision !== this.pagoSeguimientoRevision) return;
              consultar(intentosRestantes - 1);
            },
          });
      }, 5000);
    };
    consultar(60);
  }

  private actualizarTurnoIndividual(
    turnoId: number,
    detalle: TurnoClienteDetalleDTO,
  ): void {
    if (this.turnoSeleccionado()?.id === turnoId) {
      this.detalle.set(detalle);
      this.detalleCargando.set(false);
      this.detalleError.set(null);
    }
    this.turnos.update((turnos) =>
      turnos.map((turno) =>
        turno.id === turnoId ? { ...turno, estadoTurno: detalle.estadoTurno } : turno,
      ),
    );
  }

  private cancelarSeguimientoPago(): void {
    this.pagoSeguimientoRevision++;
    if (this.pagoSeguimientoTimer) {
      clearTimeout(this.pagoSeguimientoTimer);
      this.pagoSeguimientoTimer = undefined;
    }
    this.pagoSeguimientoSub?.unsubscribe();
    this.pagoSeguimientoSub = undefined;
  }

  private enfocarPrimerCampoInvalido(): void {
    if (this.reseniaPuntuacion() === null) {
      this.enfocarPuntuacion();
      return;
    }
    this.enfocarComentario();
  }

  private cerrarResenia(): void {
    this.reseniaAbierta.set(false);
    this.reseniaConfirmacion.set(false);
    this.reseniaIntentada.set(false);
    this.reseniaEnviando.set(false);
    this.reseniaError.set(null);
    this.reseniaPuntuacion.set(null);
    this.reseniaComentario.set('');
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
