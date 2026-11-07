import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import {
  SolicitudEmpleadorDetalleDTO,
  claseEstadoSolicitud,
  etiquetaEstadoSolicitud,
  formatearFechaSolicitud,
} from '../../models/solicitud-empleador';

export interface SolicitanteSolicitudEmpleador {
  readonly nombre: string;
  readonly apellido: string;
  /** Solo se muestra cuando el origen del dato es confiable. */
  readonly email?: string | null;
}

@Component({
  selector: 'app-solicitud-empleador-detalle',
  templateUrl: './solicitud-empleador-detalle.html',
  styleUrl: './solicitud-empleador-detalle.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SolicitudEmpleadorDetalle {
  readonly detalle = input.required<SolicitudEmpleadorDetalleDTO>();
  /**
   * El detalle del backend expone el usuario de la sesión que consulta. En el
   * panel administrador el solicitante se toma del listado mini para no mostrar
   * los datos del administrador como si fueran del postulante.
   */
  readonly solicitante = input<SolicitanteSolicitudEmpleador | null>(null);

  protected readonly fecha = computed(() => formatearFechaSolicitud(this.detalle().fechaSolicitud));
  protected readonly etiqueta = computed(() => etiquetaEstadoSolicitud(this.detalle().estado));
  protected readonly claseEstado = computed(() => claseEstadoSolicitud(this.detalle().estado));
  protected readonly nombreCompleto = computed(() => {
    const solicitante = this.solicitante();
    if (solicitante) return `${solicitante.nombre} ${solicitante.apellido}`.trim();

    const usuario = this.detalle().usuario;
    return `${usuario.nombre} ${usuario.apellido}`.trim();
  });
  protected readonly email = computed(() => {
    const solicitante = this.solicitante();
    return solicitante ? solicitante.email?.trim() || null : this.detalle().usuario.email;
  });
}
