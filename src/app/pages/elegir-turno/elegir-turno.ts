import { HttpErrorResponse } from '@angular/common/http';
import { Location } from '@angular/common';
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
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject, forkJoin, of } from 'rxjs';
import { catchError, map, startWith, switchMap, tap } from 'rxjs/operators';

import { LoginModal } from '../../components/login-modal/login-modal';
import { EmpleadoDTO } from '../../models/empleado';
import { ServicioDTO } from '../../models/servicio';
import { SucursalDetalleDTO } from '../../models/sucursal';
import { DisponibilidadDTO, TurnoMiniDTO } from '../../models/turno';
import { authService } from '../../services/auth-service';
import { empleadoService } from '../../services/empleado-service';
import { reservaContextoService } from '../../services/reserva-contexto-service';
import { servicioService } from '../../services/servicio-service';
import { sucursalService } from '../../services/sucursal-service';
import { turnoService } from '../../services/turno-service';
import { DsButtonComponent } from '../../shared/ui/button/button.component';

type Resultado<T> =
  | { readonly ok: true; readonly datos: T }
  | { readonly ok: false; readonly error: HttpErrorResponse };

interface ResumenPuntuacion {
  readonly tienePuntuacion: boolean;
  readonly numero: string;
  readonly abejas: readonly number[];
}

interface DiaDisponible {
  readonly fecha: string;
  readonly numero: string;
  readonly mes: string;
  readonly etiqueta: string;
  readonly horarios: readonly string[];
}

const FORMATO_PUNTUACION = new Intl.NumberFormat('es-AR', {
  maximumFractionDigits: 1,
});

const FORMATO_FECHA_COMPLETA = new Intl.DateTimeFormat('es-AR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

const MESES_ABREVIADOS = [
  'Ene.',
  'Feb.',
  'Mar.',
  'Abr.',
  'May.',
  'Jun.',
  'Jul.',
  'Ago.',
  'Sep.',
  'Oct.',
  'Nov.',
  'Dic.',
];

const MAXIMO_ABEJAS = 5;
const MENSAJE_SIN_CONEXION = 'Revisá tu conexión a internet y volvé a intentar.';

/**
 * Tercer paso de la reserva: elegir día y horario. Los días y horarios se
 * muestran exclusivamente a partir de la respuesta del backend; la pantalla
 * no calcula disponibilidad ni inventa turnos.
 */
@Component({
  selector: 'app-elegir-turno',
  imports: [DsButtonComponent, RouterLink, LoginModal],
  templateUrl: './elegir-turno.html',
  styleUrl: './elegir-turno.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ElegirTurno {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly auth = inject(authService);
  private readonly sucursalApi = inject(sucursalService);
  private readonly serviciosApi = inject(servicioService);
  private readonly empleadosApi = inject(empleadoService);
  private readonly turnosApi = inject(turnoService);
  private readonly reservaContexto = inject(reservaContextoService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly location = inject(Location);

  protected readonly sucursalId = signal<number | null>(null);
  protected readonly servicioId = signal<number | null>(null);
  protected readonly empleadoId = signal<number | null>(null);

  protected readonly sucursal = signal<SucursalDetalleDTO | null>(null);
  protected readonly servicio = signal<ServicioDTO | null>(null);
  protected readonly empleado = signal<EmpleadoDTO | null>(null);
  protected readonly disponibilidad = signal<readonly DisponibilidadDTO[]>([]);

  protected readonly fechaSeleccionada = signal<string | null>(null);
  protected readonly horaSeleccionada = signal<string | null>(null);

  protected readonly cargandoContexto = signal(false);
  protected readonly cargandoDisponibilidad = signal(false);
  protected readonly reintentandoContexto = signal(false);
  protected readonly reintentandoDisponibilidad = signal(false);
  protected readonly errorContexto = signal<string | null>(null);
  protected readonly errorDisponibilidad = signal<string | null>(null);
  protected readonly aviso = signal<string | null>(null);
  protected readonly sinConexion = signal(!this.hayConexion());
  protected readonly loginAbierto = signal(false);
  protected readonly navegando = signal(false);
  protected readonly sinPermisoReserva = signal(false);
  protected readonly contextoInvalido = signal(false);

  private readonly recargarContexto = new Subject<void>();
  private readonly recargarDisponibilidad = new Subject<void>();
  private readonly fechaUrl = this.route.snapshot.queryParamMap.get('fecha');
  private readonly horaUrl = this.route.snapshot.queryParamMap.get('hora');
  private readonly errorConexionContexto = signal(false);
  private readonly errorConexionDisponibilidad = signal(false);

  private primeraCargaDisponibilidad = true;
  private ultimoBoton: HTMLElement | null = null;

  protected readonly sinContexto = computed(
    () =>
      this.sucursalId() === null ||
      this.servicioId() === null ||
      this.empleadoId() === null,
  );

  protected readonly resumenContexto = computed(() => {
    const sucursal = this.sucursal();
    const servicio = this.servicio();
    const empleado = this.empleado();

    return {
      sucursal: {
        nombre:
          sucursal?.nombre?.trim() ||
          servicio?.nombreSucursal?.trim() ||
          (this.sucursalId() !== null ? `Sucursal #${this.sucursalId()}` : 'Sucursal'),
        ...this.construirPuntuacion(
          sucursal?.puntuacion,
          sucursal?.cantidadPuntuaciones,
        ),
      },
      servicio: {
        nombre:
          servicio?.nombre?.trim() ||
          (this.servicioId() !== null ? `Servicio #${this.servicioId()}` : 'Servicio'),
        ...this.construirPuntuacion(
          servicio?.puntuacion,
          servicio?.cantidadPuntuaciones,
        ),
      },
      empleado: {
        nombre: empleado
          ? this.nombreCompleto(empleado)
          : this.empleadoId() !== null
            ? `Profesional #${this.empleadoId()}`
            : 'Profesional',
        ...this.construirPuntuacion(
          empleado?.puntuacion,
          empleado?.cantidadPuntuaciones,
        ),
      },
    };
  });

  /** Sólo se muestran los días que el backend devolvió con horarios. */
  protected readonly diasDisponibles = computed<readonly DiaDisponible[]>(() => {
    const dias: DiaDisponible[] = [];

    for (const dia of this.disponibilidad()) {
      if (!Array.isArray(dia.horarios) || dia.horarios.length === 0) {
        continue;
      }

      const partes = this.partesFecha(dia.fecha);
      if (!partes) {
        continue;
      }

      dias.push({
        fecha: dia.fecha,
        numero: partes.numero,
        mes: partes.mes,
        etiqueta: partes.etiqueta,
        horarios: dia.horarios,
      });
    }

    return dias;
  });

  protected readonly horariosDiaSeleccionado = computed<readonly string[]>(() => {
    const fecha = this.fechaSeleccionada();
    if (!fecha) {
      return [];
    }

    const dia = this.diasDisponibles().find((item) => item.fecha === fecha);
    if (!dia) {
      return [];
    }

    return [...dia.horarios].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  });

  protected readonly etiquetaFechaSeleccionada = computed(() => {
    const fecha = this.fechaSeleccionada();
    if (!fecha) {
      return '';
    }

    return this.diasDisponibles().find((dia) => dia.fecha === fecha)?.etiqueta ?? '';
  });

  protected readonly resumenSeleccion = computed(() => {
    const fecha = this.fechaSeleccionada();
    const hora = this.horaSeleccionada();
    if (!fecha || !hora) {
      return null;
    }

    return {
      fecha: this.etiquetaFechaSeleccionada() || fecha,
      hora: this.horaTexto(hora),
    };
  });

  /** «Continuar» sólo se habilita cuando hay un horario seleccionado. */
  protected readonly puedeContinuar = computed(
    () => this.fechaSeleccionada() !== null && this.horaSeleccionada() !== null,
  );

  /** Durante una recarga o navegación se evita cambiar la selección. */
  protected readonly seleccionDeshabilitada = computed(
    () =>
      this.cargandoContexto() ||
      this.reintentandoContexto() ||
      this.cargandoDisponibilidad() ||
      this.reintentandoDisponibilidad() ||
      this.navegando(),
  );

  protected readonly destinoRetorno = computed(() => {
    const sucursalId = this.sucursalId() ?? 0;
    const servicioId = this.servicioId() ?? 0;
    return this.router.serializeUrl(
      this.router.createUrlTree(
        ['/sucursal', sucursalId, 'servicios', servicioId, 'turnos'],
        { queryParams: this.queryParamsSeleccion() },
      ),
    );
  });

  protected readonly volverLink = computed<readonly (string | number)[]>(() => {
    const sucursalId = this.sucursalId();
    const servicioId = this.servicioId();
    return sucursalId !== null && servicioId !== null
      ? ['/sucursal', sucursalId, 'servicios', servicioId, 'empleados']
      : ['/'];
  });

  protected readonly volverQueryParams = computed(() => {
    const params: Record<string, string | number> = {};
    const empleadoId = this.empleadoId();
    if (empleadoId !== null) {
      params['empleadoId'] = empleadoId;
    }
    const fecha = this.fechaSeleccionada();
    if (fecha) {
      params['fecha'] = fecha;
    }
    const hora = this.horaSeleccionada();
    if (hora) {
      params['hora'] = hora;
    }
    return params;
  });

  private readonly onOffline = (): void => {
    this.sinConexion.set(true);
    if (this.errorConexionContexto()) {
      this.errorContexto.set(MENSAJE_SIN_CONEXION);
    }
    if (this.errorConexionDisponibilidad()) {
      this.errorDisponibilidad.set(MENSAJE_SIN_CONEXION);
    }
  };

  private readonly onOnline = (): void => {
    this.sinConexion.set(false);
    if (this.errorConexionContexto()) {
      this.errorContexto.set(
        'La conexión volvió a estar disponible. Reintentá para cargar la reserva.',
      );
    }
    if (this.errorConexionDisponibilidad()) {
      this.errorDisponibilidad.set(
        'La conexión volvió a estar disponible. Reintentá para cargar los horarios.',
      );
    }
  };

  constructor() {
    this.sucursalId.set(this.parseId(this.route.snapshot.paramMap.get('sucursalId')));
    this.servicioId.set(this.parseId(this.route.snapshot.paramMap.get('servicioId')));
    this.empleadoId.set(this.parseId(this.route.snapshot.queryParamMap.get('empleadoId')));

    this.registrarEventosDeConexion();

    const sucursalId = this.sucursalId();
    const servicioId = this.servicioId();
    const empleadoId = this.empleadoId();

    if (sucursalId === null || servicioId === null || empleadoId === null) {
      return;
    }

    this.cargarContexto(sucursalId, servicioId, empleadoId);
    this.cargarDisponibilidad(empleadoId, servicioId);
  }

  protected reintentarContexto(): void {
    if (this.cargandoContexto() || this.reintentandoContexto()) {
      return;
    }

    this.reintentandoContexto.set(true);
    this.recargarContexto.next();
  }

  protected reintentarDisponibilidad(): void {
    if (this.cargandoDisponibilidad() || this.reintentandoDisponibilidad()) {
      return;
    }

    this.reintentandoDisponibilidad.set(true);
    this.recargarDisponibilidad.next();
  }

  /** El aviso de conexión conserva el contexto y sólo recarga los horarios. */
  protected reintentarConexion(): void {
    this.reintentarDisponibilidad();
  }

  protected seleccionarFecha(fecha: string, enfocarPrimerHorario = false): void {
    if (this.seleccionDeshabilitada()) {
      return;
    }

    const dia = this.diasDisponibles().find((item) => item.fecha === fecha);
    if (!dia) {
      return;
    }

    const fechaAnterior = this.fechaSeleccionada();
    this.fechaSeleccionada.set(fecha);
    if (fechaAnterior !== fecha) {
      this.horaSeleccionada.set(null);
    }
    this.aviso.set(null);
    this.sincronizarUrl();

    if (enfocarPrimerHorario) {
      queueMicrotask(() => this.enfocarPrimerHorario());
    }
  }

  protected seleccionarHora(hora: string): void {
    if (this.seleccionDeshabilitada()) {
      return;
    }

    if (
      !this.fechaSeleccionada() ||
      !this.horariosDiaSeleccionado().includes(hora)
    ) {
      return;
    }

    this.horaSeleccionada.set(hora);
    this.aviso.set(null);
    this.sincronizarUrl();
  }

  protected estaSeleccionadoDia(dia: DiaDisponible): boolean {
    return this.fechaSeleccionada() === dia.fecha;
  }

  protected estaSeleccionadoHorario(hora: string): boolean {
    return this.horaSeleccionada() === hora;
  }

  protected esDiaEnfocable(dia: DiaDisponible): boolean {
    const fecha = this.fechaSeleccionada();
    if (fecha !== null) {
      return fecha === dia.fecha;
    }
    return this.diasDisponibles()[0]?.fecha === dia.fecha;
  }

  protected esHoraEnfocable(hora: string): boolean {
    const seleccionada = this.horaSeleccionada();
    if (seleccionada !== null) {
      return seleccionada === hora;
    }
    return this.horariosDiaSeleccionado()[0] === hora;
  }

  protected onTeclaDia(event: KeyboardEvent, dia: DiaDisponible): void {
    if (this.seleccionDeshabilitada()) {
      return;
    }

    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      this.seleccionarFecha(dia.fecha, true);
      return;
    }

    const navegacion = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'];
    if (!navegacion.includes(event.key)) {
      return;
    }

    const lista = this.diasDisponibles();
    const actual = lista.findIndex((item) => item.fecha === dia.fecha);
    if (actual < 0 || lista.length === 0) {
      return;
    }

    event.preventDefault();
    let destino = actual;

    if (event.key === 'Home') {
      destino = 0;
    } else if (event.key === 'End') {
      destino = lista.length - 1;
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      destino = (actual + 1) % lista.length;
    } else {
      destino = (actual - 1 + lista.length) % lista.length;
    }

    const siguiente = lista[destino];
    this.seleccionarFecha(siguiente.fecha);
    this.enfocarDia(siguiente.fecha);
  }

  protected onTeclaHora(event: KeyboardEvent, hora: string): void {
    if (this.seleccionDeshabilitada()) {
      return;
    }

    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      this.seleccionarHora(hora);
      this.enfocarHora(hora);
      return;
    }

    const navegacion = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'];
    if (!navegacion.includes(event.key)) {
      return;
    }

    const lista = this.horariosDiaSeleccionado();
    const actual = lista.findIndex((item) => item === hora);
    if (actual < 0 || lista.length === 0) {
      return;
    }

    event.preventDefault();
    let destino = actual;

    if (event.key === 'Home') {
      destino = 0;
    } else if (event.key === 'End') {
      destino = lista.length - 1;
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      destino = (actual + 1) % lista.length;
    } else {
      destino = (actual - 1 + lista.length) % lista.length;
    }

    const siguiente = lista[destino];
    this.seleccionarHora(siguiente);
    this.enfocarHora(siguiente);
  }

  protected continuar(event?: Event): void {
    if (event?.currentTarget instanceof HTMLElement) {
      this.ultimoBoton = event.currentTarget;
    }

    if (this.navegando() || !this.puedeContinuar()) {
      return;
    }

    this.sinPermisoReserva.set(false);

    if (!this.auth.autenticado()) {
      this.loginAbierto.set(true);
      return;
    }

    this.loginAbierto.set(false);

    if (!this.auth.tieneAlgunRol('CLIENTE')) {
      this.sinPermisoReserva.set(true);
      this.aviso.set('Tu cuenta no tiene permiso para reservar');
      return;
    }

    const fecha = this.fechaSeleccionada();
    const hora = this.horaSeleccionada();
    const sucursalId = this.sucursalId();
    const servicioId = this.servicioId();
    const empleadoId = this.empleadoId();

    if (
      !fecha ||
      !hora ||
      sucursalId === null ||
      servicioId === null ||
      empleadoId === null
    ) {
      return;
    }

    this.navegando.set(true);
    this.router
      .navigate(
        ['/sucursal', sucursalId, 'servicios', servicioId, 'turnos', 'pago'],
        { queryParams: { empleadoId, fecha, hora } },
      )
      .then((navego) => {
        if (!navego) {
          this.navegando.set(false);
        }
      })
      .catch(() => this.navegando.set(false));
  }

  protected cerrarLogin(): void {
    this.loginAbierto.set(false);
    queueMicrotask(() => this.ultimoBoton?.focus());
  }

  protected horaTexto(hora: string): string {
    return hora.slice(0, 5);
  }

  protected trackFecha(_index: number, dia: DiaDisponible): string {
    return dia.fecha;
  }

  protected trackHora(_index: number, hora: string): string {
    return hora;
  }

  protected nombreCompleto(empleado: EmpleadoDTO): string {
    const nombre = empleado.nombre?.trim() || 'Profesional';
    const apellido = empleado.apellido?.trim() || '';
    return [nombre, apellido].filter(Boolean).join(' ');
  }

  private cargarContexto(
    sucursalId: number,
    servicioId: number,
    empleadoId: number,
  ): void {
    this.recargarContexto
      .pipe(
        startWith(undefined as void),
        tap(() => {
          const sinDatos =
            this.sucursal() === null &&
            this.servicio() === null &&
            this.empleado() === null;
          this.cargandoContexto.set(sinDatos);
          this.reintentandoContexto.set(this.errorContexto() !== null);
          this.sinConexion.set(!this.hayConexion());
        }),
        switchMap(() =>
          forkJoin({
            sucursal: this.sucursalApi.obtenerPorId(sucursalId, true).pipe(
              map((datos): Resultado<SucursalDetalleDTO> => ({ ok: true, datos })),
              catchError((error: HttpErrorResponse) =>
                of<Resultado<SucursalDetalleDTO>>({ ok: false, error }),
              ),
            ),
            servicios: this.serviciosApi.listarPorSucursal(sucursalId).pipe(
              map((datos): Resultado<readonly ServicioDTO[]> => ({ ok: true, datos })),
              catchError((error: HttpErrorResponse) =>
                of<Resultado<readonly ServicioDTO[]>>({ ok: false, error }),
              ),
            ),
            empleados: this.empleadosApi.listarPorSucursal(sucursalId).pipe(
              map((datos): Resultado<readonly EmpleadoDTO[]> => ({
                ok: true,
                datos: datos ?? [],
              })),
              catchError((error: HttpErrorResponse) =>
                of<Resultado<readonly EmpleadoDTO[]>>({ ok: false, error }),
              ),
            ),
          }),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ sucursal, servicios, empleados }) => {
        this.cargandoContexto.set(false);
        this.reintentandoContexto.set(false);

        if (sucursal.ok) {
          this.sucursal.set(sucursal.datos);
        }

        if (servicios.ok) {
          this.servicio.set(
            servicios.datos.find((item) => item.id === servicioId) ?? null,
          );
        }

        if (!empleados.ok) {
          this.empleado.set(null);
          this.aplicarErrorEmpleados(empleados.error);
          return;
        }

        const encontrado =
          empleados.datos.find((item) => item.id === empleadoId) ?? null;
        this.empleado.set(encontrado);

        if (!encontrado) {
          this.errorContexto.set(
            'El profesional seleccionado ya no está disponible. Volvé a elegir un profesional para continuar.',
          );
          return;
        }

        if (servicios.ok && this.servicio() === null) {
          this.contextoInvalido.set(true);
          this.reservaContexto.limpiar();
          this.errorContexto.set(
            'Este servicio no pertenece a la sucursal o ya no está disponible.',
          );
          return;
        }

        this.errorContexto.set(null);
        this.errorConexionContexto.set(false);
        this.sinConexion.set(false);
      });
  }

  private liberarHorariosRechazados(
    dias: readonly DisponibilidadDTO[],
    turnos: readonly TurnoMiniDTO[],
    nombreServicio: string,
  ): readonly DisponibilidadDTO[] {
    const rechazados = (turnos ?? []).filter(
      (turno) =>
        turno.estadoTurno === 'PAGO_RECHAZADO' &&
        turno.nombreServicio === nombreServicio,
    );

    if (!rechazados.length) {
      return dias ?? [];
    }

    const resultado = (dias ?? []).map((dia) => ({
      fecha: dia.fecha,
      horarios: [...(dia.horarios ?? [])],
    }));

    for (const turno of rechazados) {
      const fechaTurno = (turno.fechaTurno ?? '').slice(0, 10);
      const horaTurno = (turno.fechaTurno ?? '').slice(11, 19);
      if (!fechaTurno || !horaTurno) {
        continue;
      }

      let dia = resultado.find((item) => item.fecha === fechaTurno);
      if (!dia) {
        dia = { fecha: fechaTurno, horarios: [] };
        resultado.push(dia);
      }

      if (!dia.horarios.includes(horaTurno)) {
        dia.horarios.push(horaTurno);
        dia.horarios.sort();
      }
    }

    return resultado;
  }

  private cargarDisponibilidad(empleadoId: number, servicioId: number): void {
    this.recargarDisponibilidad
      .pipe(
        startWith(undefined as void),
        tap(() => {
          const primera =
            this.disponibilidad().length === 0 && this.errorDisponibilidad() === null;
          this.cargandoDisponibilidad.set(primera);
          this.reintentandoDisponibilidad.set(this.errorDisponibilidad() !== null);
          this.sinConexion.set(!this.hayConexion());
        }),
        switchMap(() =>
          forkJoin({
            dias: this.turnosApi.disponibilidad(empleadoId, servicioId),
            turnos: this.turnosApi.propios().pipe(catchError(() => of<TurnoMiniDTO[]>([]))),
          }).pipe(
            map(({ dias, turnos }): Resultado<readonly DisponibilidadDTO[]> => ({
              ok: true,
              datos: this.liberarHorariosRechazados(dias ?? [], turnos ?? [], this.servicio()?.nombre ?? ''),
            })),
            catchError((error: HttpErrorResponse) =>
              of<Resultado<readonly DisponibilidadDTO[]>>({ ok: false, error }),
            ),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((resultado) => {
        this.cargandoDisponibilidad.set(false);
        this.reintentandoDisponibilidad.set(false);

        if (!resultado.ok) {
          this.aplicarErrorDisponibilidad(resultado.error);
          return;
        }

        this.errorDisponibilidad.set(null);
        this.errorConexionDisponibilidad.set(false);
        this.sinConexion.set(false);
        this.disponibilidad.set(resultado.datos);
        this.reconciliarSeleccion();
      });
  }

  /**
   * Al cargar los horarios se restaura la selección de la URL. Si el día o el
   * horario dejaron de estar disponibles, se informa y se conserva el contexto
   * para que la persona elija otra opción sin reiniciar la reserva.
   */
  private reconciliarSeleccion(): void {
    if (this.primeraCargaDisponibilidad) {
      this.primeraCargaDisponibilidad = false;

      if (!this.fechaUrl) {
        return;
      }

      const dia = this.diasDisponibles().find(
        (item) => item.fecha === this.fechaUrl,
      );
      if (!dia) {
        this.fechaSeleccionada.set(null);
        this.horaSeleccionada.set(null);
        this.aviso.set(
          'El día que intentaste preseleccionar ya no está disponible. Elegí otro día y horario para continuar.',
        );
        this.sincronizarUrl();
        return;
      }

      this.fechaSeleccionada.set(dia.fecha);

      if (!this.horaUrl) {
        return;
      }

      if (dia.horarios.includes(this.horaUrl)) {
        this.horaSeleccionada.set(this.horaUrl);
        return;
      }

      this.horaSeleccionada.set(null);
      this.aviso.set(
        'El horario que intentaste preseleccionar ya no está disponible. Elegí otro horario para continuar.',
      );
      this.sincronizarUrl();
      return;
    }

    const fecha = this.fechaSeleccionada();
    if (!fecha) {
      return;
    }

    const dia = this.diasDisponibles().find((item) => item.fecha === fecha);
    if (!dia) {
      this.fechaSeleccionada.set(null);
      this.horaSeleccionada.set(null);
      this.aviso.set(
        'El día que habías elegido ya no está disponible. Elegí otro día y horario para continuar.',
      );
      this.sincronizarUrl();
      return;
    }

    const hora = this.horaSeleccionada();
    if (hora && !dia.horarios.includes(hora)) {
      this.horaSeleccionada.set(null);
      this.aviso.set(
        'El horario que habías elegido ya no está disponible. Elegí otro horario para continuar.',
      );
      this.sincronizarUrl();
    }
  }

  private queryParamsSeleccion(): Record<string, string | number> {
    const params: Record<string, string | number> = {};
    const empleadoId = this.empleadoId();
    if (empleadoId !== null) {
      params['empleadoId'] = empleadoId;
    }
    const fecha = this.fechaSeleccionada();
    if (fecha) {
      params['fecha'] = fecha;
    }
    const hora = this.horaSeleccionada();
    if (hora) {
      params['hora'] = hora;
    }
    return params;
  }

    private sincronizarUrl(): void {
    const url = this.router
      .createUrlTree([], {
        relativeTo: this.route,
        queryParams: this.queryParamsSeleccion(),
      })
      .toString();

    this.location.replaceState(url);
  }

  private aplicarErrorEmpleados(error: HttpErrorResponse): void {
    this.errorConexionContexto.set(false);

    if (error.status === 0) {
      this.errorConexionContexto.set(true);
      if (!this.hayConexion()) {
        this.sinConexion.set(true);
        this.errorContexto.set(MENSAJE_SIN_CONEXION);
      } else {
        this.sinConexion.set(false);
        this.errorContexto.set(
          'No pudimos conectar con el servidor. Revisá tu conexión e intentá de nuevo.',
        );
      }
      return;
    }

    if (error.status === 404) {
      this.errorContexto.set('No encontramos los profesionales de esta sucursal.');
      return;
    }

    this.errorContexto.set(
      'No pudimos cargar los profesionales de esta sucursal. Reintentá en unos momentos.',
    );
  }

  private aplicarErrorDisponibilidad(error: HttpErrorResponse): void {
    this.errorConexionDisponibilidad.set(false);

    if (error.status === 0) {
      this.errorConexionDisponibilidad.set(true);
      if (!this.hayConexion()) {
        this.sinConexion.set(true);
        this.errorDisponibilidad.set(MENSAJE_SIN_CONEXION);
      } else {
        this.sinConexion.set(false);
        this.errorDisponibilidad.set(
          'No pudimos conectar con el servidor. Revisá tu conexión e intentá de nuevo.',
        );
      }
      return;
    }

    if (error.status === 400 || error.status === 404) {
      this.errorDisponibilidad.set(
        'No pudimos cargar la disponibilidad de este profesional. Volvé a elegir el profesional e intentá de nuevo.',
      );
      return;
    }

    this.errorDisponibilidad.set(
      'No pudimos cargar los horarios disponibles. Reintentá en unos momentos.',
    );
  }

  private construirPuntuacion(
    puntuacion: number | null | undefined,
    cantidadPuntuaciones: number | null | undefined,
  ): ResumenPuntuacion {
    if (
      typeof puntuacion !== 'number' ||
      !Number.isFinite(puntuacion) ||
      typeof cantidadPuntuaciones !== 'number' ||
      !Number.isFinite(cantidadPuntuaciones) ||
      cantidadPuntuaciones <= 0
    ) {
      return { tienePuntuacion: false, numero: '', abejas: [] };
    }

    const abejas = Math.max(
      0,
      Math.min(MAXIMO_ABEJAS, Math.round(puntuacion)),
    );

    return {
      tienePuntuacion: true,
      numero: `${FORMATO_PUNTUACION.format(puntuacion)}/${MAXIMO_ABEJAS}`,
      abejas: Array.from({ length: abejas }),
    };
  }

  private partesFecha(
    fecha: string,
  ): { numero: string; mes: string; etiqueta: string } | null {
    const coincidencia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha?.trim() ?? '');
    if (!coincidencia) {
      return null;
    }

    const anio = Number(coincidencia[1]);
    const mes = Number(coincidencia[2]);
    const dia = Number(coincidencia[3]);

    if (
      !Number.isInteger(anio) ||
      !Number.isInteger(mes) ||
      !Number.isInteger(dia) ||
      mes < 1 ||
      mes > 12 ||
      dia < 1 ||
      dia > 31
    ) {
      return null;
    }

    const fechaLocal = new Date(anio, mes - 1, dia);
    if (
      fechaLocal.getFullYear() !== anio ||
      fechaLocal.getMonth() !== mes - 1 ||
      fechaLocal.getDate() !== dia
    ) {
      return null;
    }

    return {
      numero: String(dia),
      mes: MESES_ABREVIADOS[mes - 1]!,
      etiqueta: FORMATO_FECHA_COMPLETA.format(fechaLocal),
    };
  }

  private enfocarDia(fecha: string): void {
    this.host.nativeElement
      .querySelector<HTMLButtonElement>(`[data-fecha="${fecha}"]`)
      ?.focus();
  }

  private enfocarHora(hora: string): void {
    this.host.nativeElement
      .querySelector<HTMLButtonElement>(`[data-hora="${hora}"]`)
      ?.focus();
  }

  private enfocarPrimerHorario(): void {
    const primera = this.horariosDiaSeleccionado()[0];
    if (primera) {
      this.enfocarHora(primera);
    }
  }

  private registrarEventosDeConexion(): void {
    if (typeof window === 'undefined') {
      return;
    }

    window.addEventListener('offline', this.onOffline);
    window.addEventListener('online', this.onOnline);
    this.destroyRef.onDestroy(() => {
      window.removeEventListener('offline', this.onOffline);
      window.removeEventListener('online', this.onOnline);
    });
  }

  private hayConexion(): boolean {
    return typeof navigator === 'undefined' || navigator.onLine;
  }

  private parseId(value: string | null): number | null {
    if (!value?.trim()) {
      return null;
    }

    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
  }
}
