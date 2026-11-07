import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import {
  EstadoSolicitudEmpleador,
  SolicitudEmpleadorDetalleDTO,
  SolicitudEmpleadorMiniDTO,
  claseEstadoSolicitud,
  etiquetaEstadoSolicitud,
  formatearFechaSolicitud,
  inicialesSolicitante,
} from '../../models/solicitud-empleador';
import {
  SolicitanteSolicitudEmpleador,
  SolicitudEmpleadorDetalle,
} from '../solicitud-empleador-detalle/solicitud-empleador-detalle';

export type ModoSolicitudEmpleadorCard = 'usuario' | 'admin';
export type AccionSolicitudEmpleador = 'aprobar' | 'rechazar';

@Component({
  selector: 'app-solicitud-empleador-card',
  imports: [SolicitudEmpleadorDetalle],
  templateUrl: './solicitud-empleador-card.html',
  styleUrl: './solicitud-empleador-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SolicitudEmpleadorCard {
  readonly solicitud = input.required<SolicitudEmpleadorMiniDTO>();
  readonly detalle = input<SolicitudEmpleadorDetalleDTO | null>(null);
  readonly expandida = input(false);
  readonly cargandoDetalle = input(false);
  readonly errorDetalle = input<string | null>(null);
  /** Estado conocido sin cargar el detalle (por ejemplo, el admin solo lista pendientes). */
  readonly estadoResumen = input<EstadoSolicitudEmpleador | null>(null);
  readonly modo = input<ModoSolicitudEmpleadorCard>('usuario');
  readonly resolviendo = input<AccionSolicitudEmpleador | null>(null);
  readonly errorAccion = input<string | null>(null);
  readonly solicitante = input<SolicitanteSolicitudEmpleador | null>(null);

  readonly alternar = output<void>();
  readonly reintentarDetalle = output<void>();
  readonly aprobar = output<void>();
  readonly rechazar = output<void>();

  protected readonly nombre = computed(
    () => `${this.solicitud().nombreUsuario} ${this.solicitud().apellidoUsuario}`.trim(),
  );
  protected readonly iniciales = computed(() =>
    inicialesSolicitante(this.solicitud().nombreUsuario, this.solicitud().apellidoUsuario),
  );
  protected readonly fecha = computed(() => formatearFechaSolicitud(this.solicitud().fechaSolicitud));
  protected readonly estadoMostrado = computed(
    () => this.detalle()?.estado ?? this.estadoResumen(),
  );
  protected readonly etiqueta = computed(() => etiquetaEstadoSolicitud(this.estadoMostrado()));
  protected readonly claseEstado = computed(() => claseEstadoSolicitud(this.estadoMostrado()));
  protected readonly idDetalle = computed(() => `solicitud-empleador-detalle-${this.solicitud().id}`);
  protected readonly puedeResolver = computed(
    () => this.modo() === 'admin' && this.detalle()?.estado === 'PENDIENTE',
  );
  protected readonly etiquetaAlternar = computed(() =>
    this.expandida() ? 'Ocultar detalle' : 'Ver detalle',
  );
  protected readonly etiquetaAlternarAccesible = computed(
    () => `${this.etiquetaAlternar()} de la solicitud de ${this.nombre()}`,
  );
}
