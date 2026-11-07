import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import {
  AccionSolicitudEmpleado,
  EstadoSolicitudEmpleado,
  SolicitudEmpleadoDetalleDTO,
  SolicitudEmpleadoVista,
  TipoSolicitudEmpleado,
  claseEstadoSolicitudEmpleado,
  etiquetaEstadoSolicitudEmpleado,
  formatearFechaSolicitudEmpleado,
} from '../../models/solicitud-empleado';
import { SolicitudEmpleadoDetalle } from '../solicitud-empleado-detalle/solicitud-empleado-detalle';

@Component({
  selector: 'app-solicitud-empleado-card',
  imports: [SolicitudEmpleadoDetalle],
  templateUrl: './solicitud-empleado-card.html',
  styleUrl: './solicitud-empleado-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SolicitudEmpleadoCard {
  readonly solicitud = input.required<SolicitudEmpleadoVista>();
  readonly tipo = input.required<TipoSolicitudEmpleado>();
  readonly detalle = input<SolicitudEmpleadoDetalleDTO | null>(null);
  readonly expandida = input(false);
  readonly cargandoDetalle = input(false);
  readonly errorDetalle = input<string | null>(null);
  readonly resolviendo = input<AccionSolicitudEmpleado | null>(null);
  readonly errorAccion = input<string | null>(null);

  readonly alternar = output<void>();
  readonly reintentarDetalle = output<void>();
  readonly aprobar = output<void>();
  readonly rechazar = output<void>();

  protected readonly fecha = computed(() =>
    formatearFechaSolicitudEmpleado(this.solicitud().fechaSolicitud),
  );
  protected readonly estadoMostrado = computed<EstadoSolicitudEmpleado | null>(
    () => this.detalle()?.estadoSolicitud ?? null,
  );
  protected readonly etiqueta = computed(() =>
    etiquetaEstadoSolicitudEmpleado(this.estadoMostrado()),
  );
  protected readonly claseEstado = computed(() =>
    claseEstadoSolicitudEmpleado(this.estadoMostrado()),
  );
  protected readonly idDetalle = computed(
    () => `solicitud-empleado-detalle-${this.solicitud().id}`,
  );
  protected readonly puedeResolver = computed(
    () => this.tipo() === 'recibida' && this.detalle()?.estadoSolicitud === 'PENDIENTE',
  );
  protected readonly etiquetaAlternar = computed(() =>
    this.expandida() ? 'Ocultar detalle' : 'Ver detalle',
  );
  protected readonly etiquetaAlternarAccesible = computed(
    () => `${this.etiquetaAlternar()} de la invitación de ${this.solicitud().titulo}`,
  );
  protected readonly notaInformativa = computed(() => {
    const detalle = this.detalle();
    if (!detalle) return null;

    if (this.tipo() === 'enviada') {
      return detalle.estadoSolicitud === 'PENDIENTE'
        ? 'Solo el empleado puede aceptar o rechazar esta invitación.'
        : 'La invitación ya fue respondida por el empleado.';
    }

    return detalle.estadoSolicitud === 'PENDIENTE'
      ? null
      : 'Esta invitación ya está resuelta y no admite acciones.';
  });
}
