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
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin, from, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { firstValueFrom } from 'rxjs';

import { authService } from '../../services/auth-service';
import { empleadoService } from '../../services/empleado-service';
import { pagoService } from '../../services/pago-service';
import { servicioService } from '../../services/servicio-service';
import { sucursalService } from '../../services/sucursal-service';
import { turnoService } from '../../services/turno-service';
import { EmpleadoDTO } from '../../models/empleado';
import { ServicioDTO } from '../../models/servicio';
import { SucursalDetalleDTO } from '../../models/sucursal';
import { TurnoMiniDTO } from '../../models/turno';


const FORMATO_FECHA_COMPLETA = new Intl.DateTimeFormat('es-AR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

const FORMATO_PRECIO = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
});

@Component({
  selector: 'app-pago-turno',
  imports: [RouterLink],
  templateUrl: './pago-turno.html',
  styleUrl: './pago-turno.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PagoTurno {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(authService);
  private readonly sucursalApi = inject(sucursalService);
  private readonly servicioApi = inject(servicioService);
  private readonly empleadoApi = inject(empleadoService);
  private readonly turnosApi = inject(turnoService);
  private readonly pagosApi = inject(pagoService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly sucursalId = this.parseId(
    this.route.snapshot.paramMap.get('sucursalId'),
  );
  protected readonly servicioId = this.parseId(
    this.route.snapshot.paramMap.get('servicioId'),
  );
  protected readonly empleadoId = this.parseId(
    this.route.snapshot.queryParamMap.get('empleadoId'),
  );
  protected readonly turnoId = signal<number | null>(
    this.parseId(this.route.snapshot.queryParamMap.get('turnoId')),
  );
  private readonly fecha = this.route.snapshot.queryParamMap.get('fecha');
  private readonly hora = this.route.snapshot.queryParamMap.get('hora');

  protected readonly sucursal = signal<SucursalDetalleDTO | null>(null);
  protected readonly servicio = signal<ServicioDTO | null>(null);
  protected readonly empleado = signal<EmpleadoDTO | null>(null);

  protected readonly cargandoContexto = signal(false);
  protected readonly errorContexto = signal<string | null>(null);

  protected readonly creandoPreferencia = signal(false);
  protected readonly errorPago = signal<string | null>(null);

  protected readonly sinContexto = computed(
    () =>
      (this.sucursalId === null ||
        this.servicioId === null ||
        this.empleadoId === null ||
        !this.fecha ||
        !this.hora) &&
      this.turnoId() === null,
  );

  protected readonly volverLink = computed<readonly (string | number)[]>(() =>
    this.sucursalId !== null && this.servicioId !== null
      ? ['/sucursal', this.sucursalId, 'servicios', this.servicioId, 'turnos']
      : ['/sucursales'],
  );

  protected readonly volverQueryParams = computed(() => {
    const params: Record<string, string | number> = {};
    if (this.empleadoId !== null) {
      params['empleadoId'] = this.empleadoId;
    }
    if (this.fecha) {
      params['fecha'] = this.fecha;
    }
    if (this.hora) {
      params['hora'] = this.hora;
    }
    return params;
  });

  protected readonly resumenSeleccion = computed(() => {
    const sucursal = this.sucursal();
    const servicio = this.servicio();
    const empleado = this.empleado();
    if (!this.fecha || !this.hora) {
      return null;
    }

    return {
      sucursal: sucursal?.nombre ?? 'Sucursal',
      servicio: servicio?.nombre ?? 'Servicio',
      empleado: empleado
        ? `${empleado.nombre} ${empleado.apellido}`.trim()
        : 'Profesional',
      fecha: this.fechaTexto(this.fecha),
      hora: this.hora.slice(0, 5),
      precio: this.precioTexto(servicio?.precio ?? null),
    };
  });

  constructor() {
    if (!this.sinContexto()) {
      this.cargarContexto();
    }
  }

  protected async pagarConMercadoPago(): Promise<void> {
    if (this.creandoPreferencia() || this.sinContexto()) {
      return;
    }

    if (!this.auth.autenticado()) {
      this.errorPago.set('Necesitás iniciar sesión para continuar con el pago.');
      return;
    }

    this.creandoPreferencia.set(true);
    this.errorPago.set(null);

    try {
      let turnoId = this.turnoId();
      if (turnoId === null) {
        turnoId = await this.registrarYObtenerTurnoId();
        this.turnoId.set(turnoId);
      }

      const url = await firstValueFrom(this.pagosApi.crearPreferencia(turnoId));

      if (!url) {
        throw new Error('El backend no devolvió una URL de pago válida.');
      }

      this.guardarContextoPago(turnoId);
      window.open(url, '_blank');
    } catch (error) {
      this.errorPago.set(this.mensajeError(error));
    } finally {
      this.creandoPreferencia.set(false);
    }
  }

  private async registrarYObtenerTurnoId(): Promise<number> {
    const fecha = this.fecha;
    const hora = this.hora;
    const servicioId = this.servicioId;
    const empleadoId = this.empleadoId;
    const servicio = this.servicio();

    if (!fecha || !hora || servicioId === null || empleadoId === null) {
      throw new Error('Falta información de la reserva para registrar el turno.');
    }

    const fechaHora = `${fecha}T${hora.slice(0, 5)}`;
    await firstValueFrom(
      this.turnosApi.registrar({
        fechaHora,
        empleadoId,
        servicioId,
      }),
    );

    const turnos = await firstValueFrom(this.turnosApi.propios());
    const candidatos = (turnos ?? [])
      .filter(
        (turno) =>
          turno.estadoTurno === 'PENDIENTE' &&
          turno.nombreServicio === (servicio?.nombre ?? '') &&
          this.mismaFechaHora(turno.fechaTurno, fechaHora),
      )
      .sort((a, b) => b.id - a.id);

    const turnoId = candidatos[0]?.id ?? null;
    if (turnoId === null) {
      throw new Error('El turno se registró, pero no se pudo identificar para el pago.');
    }
    return turnoId;
  }

  private guardarContextoPago(turnoId: number): void {
    try {
      const contexto = {
        turnoId,
        sucursalId: this.sucursalId,
        servicioId: this.servicioId,
        empleadoId: this.empleadoId,
        fecha: this.fecha,
        hora: this.hora,
      };
      sessionStorage.setItem('appointmee.pago', JSON.stringify(contexto));
    } catch {
      // Ignorar errores de almacenamiento; no deben interrumpir el pago.
    }
  }

  private cargarContexto(): void {
    if (this.sucursalId === null || this.servicioId === null || this.empleadoId === null) {
      return;
    }

    this.cargandoContexto.set(true);
    this.errorContexto.set(null);

    forkJoin({
      sucursal: this.sucursalApi.obtenerPorId(this.sucursalId, true),
      servicios: this.servicioApi.listarPorSucursal(this.sucursalId),
      empleados: this.empleadoApi.listarPorSucursal(this.sucursalId),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ sucursal, servicios, empleados }) => {
          this.sucursal.set(sucursal);
          this.servicio.set(
            (servicios ?? []).find((item) => item.id === this.servicioId) ?? null,
          );
          this.empleado.set(
            (empleados ?? []).find((item) => item.id === this.empleadoId) ?? null,
          );
          this.cargandoContexto.set(false);
        },
        error: (error: HttpErrorResponse) => {
          this.errorContexto.set(this.mensajeError(error));
          this.cargandoContexto.set(false);
        },
      });
  }

  private mismaFechaHora(fechaA: string, fechaB: string): boolean {
    const a = new Date(fechaA);
    const b = new Date(fechaB);
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) {
      return false;
    }
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate() &&
      a.getHours() === b.getHours() &&
      a.getMinutes() === b.getMinutes()
    );
  }

  private precioTexto(precio: number | string | null): string {
    if (precio === null || precio === undefined || precio === '') {
      return 'A confirmar';
    }
    const numero = typeof precio === 'string' ? Number(precio) : precio;
    if (!Number.isFinite(numero)) {
      return 'A confirmar';
    }
    return FORMATO_PRECIO.format(numero);
  }

  private fechaTexto(fecha: string): string {
    const coincidencia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha.trim());
    if (!coincidencia) {
      return fecha;
    }

    const anio = Number(coincidencia[1]);
    const mes = Number(coincidencia[2]);
    const dia = Number(coincidencia[3]);
    const fechaLocal = new Date(anio, mes - 1, dia);

    if (
      fechaLocal.getFullYear() !== anio ||
      fechaLocal.getMonth() !== mes - 1 ||
      fechaLocal.getDate() !== dia
    ) {
      return fecha;
    }

    return FORMATO_FECHA_COMPLETA.format(fechaLocal);
  }

  private mensajeError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) {
        return 'Revisá tu conexión a internet y volvé a intentar.';
      }
      if (error.status === 401) {
        return 'Tu sesión expiró. Iniciá sesión nuevamente.';
      }
      if (error.status === 403) {
        return 'No tenés permisos para realizar esta acción.';
      }
      if (error.status === 409) {
        return 'El turno ya no está disponible para pagar.';
      }
      return 'Ocurrió un problema al procesar la solicitud. Intentá nuevamente.';
    }
    if (error instanceof Error && error.message) {
      return error.message;
    }
    return 'Ocurrió un problema al procesar la solicitud. Intentá nuevamente.';
  }

  private parseId(value: string | null): number | null {
    if (!value?.trim()) {
      return null;
    }

    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
  }
}