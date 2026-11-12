import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink, ActivatedRoute } from '@angular/router';
import type { Observable } from 'rxjs';

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

@Component({
  selector: 'app-graficos',
  imports: [RouterLink],
  templateUrl: './graficos.html',
  styleUrl: './graficos.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Graficos {
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly api = inject(estadisticasService);
  private readonly sucursalApi = inject(sucursalService);

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
  protected readonly adminDatos = signal<AdminEstadisticas | null>(null);
  protected readonly empleadorDatos = signal<EmpleadorEstadisticas | null>(null);
  protected readonly cargando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly primeraCargaSucursales = signal(false);

  protected readonly hayDatos = computed(() => this.adminDatos() !== null || this.empleadorDatos() !== null);
  protected readonly titulo = this.rol === 'administrador' ? 'Estadísticas de AppointMee' : 'Estadísticas de sucursal';

  constructor() {
    if (this.rol === 'administrador') {
      this.cargar();
      return;
    }

    this.primeraCargaSucursales.set(true);
    this.sucursalApi.listarPropias().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (sucursales) => {
        this.sucursales.set(sucursales);
        this.sucursalId.set(sucursales[0]?.id ?? null);
        this.primeraCargaSucursales.set(false);
        if (sucursales.length) this.cargar();
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

  protected cambiarSucursal(event: Event): void {
    const id = Number((event.target as HTMLSelectElement).value);
    this.sucursalId.set(Number.isInteger(id) && id > 0 ? id : null);
    this.empleadorDatos.set(null);
  }

  protected totalTurnos(periodo: TurnosPeriodoGrafico): number {
    return Object.values(periodo.estados).reduce((total, cantidad) => total + cantidad, 0);
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

  protected ancho(valor: number, maximo: number): number {
    return maximo > 0 ? Math.max(valor > 0 ? 2 : 0, (valor / maximo) * 100) : 0;
  }

  protected maxTurnos(): number {
    const filas = this.adminDatos()?.turnosPorPeriodo ?? this.empleadorDatos()?.turnosPorPeriodo ?? [];
    return Math.max(0, ...filas.map((fila) => this.totalTurnos(fila)));
  }

  protected maxUsuarios(): number {
    return Math.max(0, ...(this.adminDatos()?.usuarios.nuevosPorPeriodo ?? [])
      .map((fila) => this.roles.reduce((sum, rol) => sum + (fila.altasPorRol[rol] ?? 0), 0)));
  }

  protected maxSucursales(): number {
    return Math.max(0, ...(this.adminDatos()?.sucursales.nuevasPorPeriodo ?? []).map((fila) => fila.nuevas));
  }

  protected maxServicios(): number {
    return Math.max(0, ...(this.empleadorDatos()?.demandaPorServicio ?? []).map((fila) => fila.cantidad));
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
