import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink, ActivatedRoute } from '@angular/router';
import type { Observable } from 'rxjs';
import * as echarts from 'echarts/core';
import type { EChartsOption } from 'echarts';
import { BarChart, LineChart } from 'echarts/charts';
import { AriaComponent, DataZoomComponent, GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';

import type {
  AgrupacionGrafico,
  AdminEstadisticas,
  EmpleadorEstadisticas,
  EstadoTurnoGrafico,
  RolGrafico,
  TurnosPeriodoGrafico,
} from '../../models/estadisticas';
import type { SucursalMiniDTO } from '../../models/sucursal';
import { estadisticasService } from '../../services/estadisticas-service';
import { sucursalService } from '../../services/sucursal-service';

type RolPanel = 'administrador' | 'empleador';

const tokenDiseno = (nombre: string, alternativa: string): string => {
  if (typeof document === 'undefined') return alternativa;
  return getComputedStyle(document.documentElement).getPropertyValue(nombre).trim() || alternativa;
};
const ESTADO_SERIES: readonly EstadoTurnoGrafico[] = [
  'PENDIENTE', 'CONFIRMADO', 'REALIZADO', 'CANCELADO', 'PAGO_RECHAZADO',
];

echarts.use([BarChart, LineChart, GridComponent, TooltipComponent, LegendComponent, DataZoomComponent, AriaComponent, CanvasRenderer]);

@Component({
  selector: 'app-graficos',
  imports: [RouterLink, NgxEchartsDirective],
  providers: [provideEchartsCore({ echarts })],
  templateUrl: './graficos.html',
  styleUrl: './graficos.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Graficos {
  /** Modo incrustado dentro del panel de administración. */
  readonly incrustado = input(false);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly api = inject(estadisticasService);
  private readonly sucursalApi = inject(sucursalService);
  private readonly coloresGrafico = [
    tokenDiseno('--accent', '#f7c65a'),
    tokenDiseno('--success-light', '#7ee2a8'),
    tokenDiseno('--success-strong', '#22c55e'),
    tokenDiseno('--danger', '#ff7a7a'),
    tokenDiseno('--muted', '#98a2b3'),
  ];
  private readonly colorTexto = tokenDiseno('--text', '#eef2f7');
  private readonly colorSecundario = tokenDiseno('--muted', '#98a2b3');
  private readonly colorLinea = tokenDiseno('--line', 'rgba(255,255,255,.08)');
  private readonly reduceMotion = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  protected readonly rol: RolPanel = this.route.snapshot.data['rolGrafico'] === 'empleador'
    ? 'empleador'
    : 'administrador';
  protected readonly estados: readonly EstadoTurnoGrafico[] = [
    'PENDIENTE', 'CONFIRMADO', 'REALIZADO', 'CANCELADO', 'PAGO_RECHAZADO',
  ];
  protected readonly roles: readonly RolGrafico[] = ['CLIENTE', 'EMPLEADOR', 'EMPLEADO'];
  protected readonly agrupaciones: readonly AgrupacionGrafico[] = ['DIA', 'SEMANA', 'MES'];

  protected readonly desde = signal(this.fechaRelativa(-29));
  protected readonly hasta = signal(this.fechaRelativa(0));
  protected readonly agrupacion = signal<AgrupacionGrafico>('DIA');
  protected readonly sucursales = signal<readonly SucursalMiniDTO[]>([]);
  protected readonly sucursalId = signal<number | null>(null);
  protected readonly sucursalActual = computed(() =>
    this.sucursales().find((sucursal) => sucursal.id === this.sucursalId())?.nombre ?? '',
  );
  protected readonly adminDatos = signal<AdminEstadisticas | null>(null);
  protected readonly empleadorDatos = signal<EmpleadorEstadisticas | null>(null);
  protected readonly cargando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly primeraCargaSucursales = signal(false);

  protected readonly hayDatos = computed(() => this.adminDatos() !== null || this.empleadorDatos() !== null);
  protected readonly titulo = this.rol === 'administrador' ? 'Estadísticas de AppointMee' : 'Estadísticas de sucursal';

  protected readonly turnosAdminOption = computed(() => this.opcionesTurnos(this.adminDatos()?.turnosPorPeriodo ?? []));
  protected readonly turnosEmpleadorOption = computed(() => this.opcionesTurnos(this.empleadorDatos()?.turnosPorPeriodo ?? []));
  protected readonly usuariosOption = computed<EChartsOption>(() => {
    const filas = this.adminDatos()?.usuarios.nuevosPorPeriodo ?? [];
    return {
      ...this.baseOption(),
      legend: { top: 0, textStyle: { color: this.colorTexto } },
      grid: { left: 48, right: 24, top: 44, bottom: 62 },
      xAxis: { type: 'category', data: filas.map((fila) => fila.periodo), axisLabel: { color: this.colorSecundario, rotate: 25 } },
      yAxis: { type: 'value', minInterval: 1, axisLabel: { color: this.colorSecundario }, splitLine: { lineStyle: { color: this.colorLinea } } },
      dataZoom: this.zoom(filas.length),
      series: this.roles.map((rol) => ({
        name: this.rolLabel(rol), type: 'line' as const, smooth: true, symbolSize: 7,
        data: filas.map((fila) => fila.altasPorRol[rol] ?? 0),
      })),
    };
  });
  protected readonly sucursalesOption = computed<EChartsOption>(() => {
    const filas = this.adminDatos()?.sucursales.nuevasPorPeriodo ?? [];
    return {
      ...this.baseOption(),
      grid: { left: 48, right: 24, top: 24, bottom: 62 },
      xAxis: { type: 'category', data: filas.map((fila) => fila.periodo), axisLabel: { color: this.colorSecundario, rotate: 25 } },
       yAxis: { type: 'value', minInterval: 1, axisLabel: { color: this.colorSecundario }, splitLine: { lineStyle: { color: this.colorLinea } } },
      dataZoom: this.zoom(filas.length),
      series: [{ name: 'Nuevas sucursales', type: 'bar', data: filas.map((fila) => fila.nuevas), barMaxWidth: 34, itemStyle: { borderRadius: [6, 6, 0, 0] } }],
    };
  });
  protected readonly demandaOption = computed<EChartsOption>(() => {
    const filas = this.empleadorDatos()?.demandaPorServicio ?? [];
    return {
      ...this.baseOption(),
      grid: { left: 120, right: 30, top: 20, bottom: 30 },
      xAxis: { type: 'value', minInterval: 1, axisLabel: { color: this.colorSecundario }, splitLine: { lineStyle: { color: this.colorLinea } } },
      yAxis: { type: 'category', data: filas.map((fila) => fila.servicio), axisLabel: { color: this.colorSecundario, width: 105, overflow: 'truncate' } },
      series: [{ name: 'Turnos', type: 'bar', data: filas.map((fila) => fila.cantidad), barMaxWidth: 28, itemStyle: { borderRadius: [0, 6, 6, 0] } }],
    };
  });
  protected readonly cancelacionesOption = computed<EChartsOption>(() => {
    const filas = this.empleadorDatos()?.cancelaciones.porPeriodo ?? [];
    return {
      ...this.baseOption(),
      grid: { left: 48, right: 24, top: 24, bottom: 62 },
      xAxis: { type: 'category', data: filas.map((fila) => fila.periodo), axisLabel: { color: this.colorSecundario, rotate: 25 } },
      yAxis: { type: 'value', min: 0, max: 100, axisLabel: { color: this.colorSecundario, formatter: '{value}%' }, splitLine: { lineStyle: { color: this.colorLinea } } },
      dataZoom: this.zoom(filas.length),
      series: [{ name: 'Tasa de cancelación', type: 'line', smooth: true, symbolSize: 7, data: filas.map((fila) => fila.tasa), areaStyle: { opacity: 0.14 } }],
    };
  });

  constructor() {
    if (this.rol === 'administrador') {
      this.cargar();
      return;
    }

    this.primeraCargaSucursales.set(true);
    this.sucursalApi.listarPropias().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (sucursales) => {
        this.sucursales.set(sucursales);
        const sucursalSolicitada = Number(this.route.snapshot.queryParamMap?.get('sucursalId'));
        const sucursalInicial = sucursales.find((sucursal) => sucursal.id === sucursalSolicitada);
        this.sucursalId.set(sucursalInicial?.id ?? null);
        this.primeraCargaSucursales.set(false);
        if (sucursalInicial) this.cargar();
      },
      error: () => {
        this.error.set('No pudimos cargar tus sucursales.');
        this.primeraCargaSucursales.set(false);
      },
    });
  }

  protected cargar(): void {
    if (this.cargando() || !this.validarRango()) return;
    if (this.rol === 'empleador' && this.sucursalId() === null) return;

    this.cargando.set(true);
    this.error.set(null);
    const solicitud: Observable<AdminEstadisticas | EmpleadorEstadisticas> = this.rol === 'administrador'
      ? this.api.administrador(this.desde(), this.hasta(), this.agrupacion())
      : this.api.empleador(this.sucursalId()!, this.desde(), this.hasta(), this.agrupacion());

    solicitud.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (datos) => {
        if (this.rol === 'administrador') this.adminDatos.set(datos as AdminEstadisticas);
        else this.empleadorDatos.set(datos as EmpleadorEstadisticas);
        this.cargando.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.error.set(error.status === 0
          ? 'No hay conexión con el servidor. Revisá tu conexión e intentá nuevamente.'
          : 'No pudimos cargar las estadísticas. Revisá los filtros e intentá nuevamente.');
        this.cargando.set(false);
      },
    });
  }

  protected cambiarDesde(event: Event): void {
    this.desde.set((event.target as HTMLInputElement).value);
  }

  protected cambiarHasta(event: Event): void {
    this.hasta.set((event.target as HTMLInputElement).value);
  }

  protected cambiarAgrupacion(event: Event): void {
    this.agrupacion.set((event.target as HTMLSelectElement).value as AgrupacionGrafico);
  }

  protected estadoLabel(estado: EstadoTurnoGrafico): string {
    return ({
      PENDIENTE: 'Pendientes', CONFIRMADO: 'Confirmados', REALIZADO: 'Realizados',
      CANCELADO: 'Cancelados', PAGO_RECHAZADO: 'Pago rechazado',
    })[estado];
  }

  protected rolLabel(rol: RolGrafico): string {
    return ({ CLIENTE: 'Clientes', EMPLEADOR: 'Empleadores', EMPLEADO: 'Empleados' })[rol];
  }

  private opcionesTurnos(filas: TurnosPeriodoGrafico[]): EChartsOption {
    return {
      ...this.baseOption(),
      legend: { top: 0, textStyle: { color: this.colorTexto } },
      grid: { left: 48, right: 24, top: 44, bottom: 62 },
      xAxis: { type: 'category', data: filas.map((fila) => fila.periodo), axisLabel: { color: this.colorSecundario, rotate: 25 } },
      yAxis: { type: 'value', minInterval: 1, axisLabel: { color: this.colorSecundario }, splitLine: { lineStyle: { color: this.colorLinea } } },
      dataZoom: this.zoom(filas.length),
      series: ESTADO_SERIES.map((estado) => ({
        name: this.estadoLabel(estado), type: 'bar' as const, stack: 'turnos',
        data: filas.map((fila) => fila.estados[estado] ?? 0), barMaxWidth: 38,
      })),
    };
  }

  private baseOption(): EChartsOption {
    return {
      color: this.coloresGrafico,
      animation: !this.reduceMotion,
      animationDuration: 500,
      aria: { enabled: true, decal: { show: true } },
      tooltip: { trigger: 'axis', confine: true },
    };
  }

  private zoom(cantidad: number): EChartsOption['dataZoom'] {
    return cantidad > 12 ? [{ type: 'inside', zoomOnMouseWheel: false }, { type: 'slider', height: 16, bottom: 8 }] : [];
  }

  private validarRango(): boolean {
    if (!this.desde() || !this.hasta() || this.desde() > this.hasta()) {
      this.error.set('La fecha inicial debe ser anterior o igual a la fecha final.');
      return false;
    }
    return true;
  }

  private fechaRelativa(dias: number): string {
    const fecha = new Date();
    fecha.setDate(fecha.getDate() + dias);
    return [fecha.getFullYear(), `${fecha.getMonth() + 1}`.padStart(2, '0'), `${fecha.getDate()}`.padStart(2, '0')].join('-');
  }
}
