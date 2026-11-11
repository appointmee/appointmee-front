import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { authService } from '../../services/auth-service';
import { turnoService } from '../../services/turno-service';
import { TurnoClienteDetalleDTO } from '../../models/turno';

type EstadoResultado = 'loading' | 'approved' | 'rejected' | 'pending' | 'error';

@Component({
  selector: 'app-resultado-pago',
  imports: [RouterLink],
  templateUrl: './resultado-pago.html',
  styleUrl: './resultado-pago.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResultadoPago {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(authService);
  private readonly turnosApi = inject(turnoService);

  protected readonly turnoId = signal<number | null>(null);
  protected readonly detalle = signal<TurnoClienteDetalleDTO | null>(null);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly reintento = signal(0);

  protected readonly sucursalId = signal<number | null>(null);

  protected readonly estado = computed<EstadoResultado>(() => {
    if (this.cargando()) {
      return 'loading';
    }
    if (this.error()) {
      return 'error';
    }
    const detalle = this.detalle();
    if (!detalle) {
      return 'error';
    }
    switch (detalle.estadoTurno) {
      case 'CONFIRMADO':
      case 'REALIZADO':
        return 'approved';
      case 'PAGO_RECHAZADO':
        return 'rejected';
      case 'PENDIENTE':
        return 'pending';
      default:
        return 'pending';
    }
  });

  protected readonly titulo = computed(() => {
    switch (this.estado()) {
      case 'approved':
        return '¡Pago aprobado!';
      case 'rejected':
        return 'No se pudo completar la reserva';
      case 'pending':
        return 'Pago pendiente de confirmación';
      case 'error':
        return 'Ocurrió un problema';
      default:
        return 'Procesando resultado';
    }
  });

  protected readonly descripcion = computed(() => {
    switch (this.estado()) {
      case 'approved':
        return 'Tu turno fue reservado correctamente. Ya podés consultarlo en Mis turnos.';
      case 'rejected':
        return 'El pago fue rechazado y la reserva no se confirmó. Podés intentar nuevamente.';
      case 'pending':
        return 'El pago todavía está pendiente de confirmación. Consultá el estado nuevamente en unos minutos.';
      case 'error':
        return (
          this.error() ??
          'Ocurrió un problema al consultar el resultado del pago. Intentá nuevamente.'
        );
      default:
        return 'Estamos verificando el estado real de tu operación.';
    }
  });

  protected readonly estadoPagoTexto = computed(() => {
    const detalle = this.detalle();
    if (!detalle) {
      return 'Sin información';
    }
    switch (detalle.estadoTurno) {
      case 'CONFIRMADO':
        return 'Confirmado';
      case 'REALIZADO':
        return 'Realizado';
      case 'PAGO_RECHAZADO':
        return 'Rechazado';
      case 'PENDIENTE':
        return 'Pendiente';
      case 'CANCELADO':
        return 'Cancelado';
      default:
        return detalle.estadoTurno;
    }
  });

  constructor() {
    this.leerContexto();
    void this.consultarEstado();
  }

  protected async consultarEstado(): Promise<void> {
    const turnoId = this.turnoId();
    if (turnoId === null) {
      this.cargando.set(false);
      this.error.set('No se pudo identificar el turno para consultar el resultado.');
      return;
    }

    if (!this.auth.autenticado()) {
      this.cargando.set(false);
      this.error.set('Necesitás iniciar sesión para consultar el resultado.');
      return;
    }

    this.cargando.set(true);
    this.error.set(null);

    try {
      const detalle = await firstValueFrom(this.turnosApi.detallePropio(turnoId));
      this.detalle.set(detalle);
    } catch (error) {
      this.detalle.set(null);
      this.error.set(this.mensajeError(error));
    } finally {
      this.cargando.set(false);
    }
  }

  protected volverASucursal(): void {
    const sucursalId = this.sucursalId();
    if (sucursalId !== null) {
      void this.router.navigate(['/sucursal', sucursalId]);
    } else {
      void this.router.navigate(['/sucursales']);
    }
  }

  private leerContexto(): void {
    const params = this.route.snapshot.queryParamMap;
    const turnoIdParam =
      params.get('turnoId') ?? params.get('external_reference') ?? params.get('externalReference');
    const sucursalParam = params.get('sucursalId');
    this.turnoId.set(this.parseId(turnoIdParam));
    this.sucursalId.set(this.parseId(sucursalParam));

    if (this.turnoId() === null || this.sucursalId() === null) {
      try {
        const raw = sessionStorage.getItem('appointmee.pago');
        if (raw) {
          const contexto = JSON.parse(raw) as {
            turnoId?: number;
            sucursalId?: number | null;
          };
          if (this.turnoId() === null && contexto.turnoId) {
            this.turnoId.set(contexto.turnoId);
          }
          if (this.sucursalId() === null && contexto.sucursalId) {
            this.sucursalId.set(contexto.sucursalId);
          }
        }
      } catch {
        // Ignorar errores de lectura; se usará el fallback.
      }
    }
  }

  private mensajeError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) {
        return 'Revisá tu conexión a internet y volvé a intentar.';
      }
      if (error.status === 401) {
        return 'Tu sesión expiró. Iniciá sesión nuevamente.';
      }
      if (error.status === 404) {
        return 'No encontramos el turno asociado a esta operación.';
      }
      return 'Ocurrió un problema al consultar el resultado. Intentá nuevamente.';
    }
    return 'Ocurrió un problema al consultar el resultado. Intentá nuevamente.';
  }

  private parseId(value: string | null): number | null {
    if (!value?.trim()) {
      return null;
    }
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
  }
}