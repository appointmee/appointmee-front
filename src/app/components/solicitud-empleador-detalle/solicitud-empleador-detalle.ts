import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import {
  SolicitudEmpleadorDetalleDTO,
  UbicacionGuardadaSolicitudEmpleadorDTO,
  claseEstadoSolicitud,
  etiquetaEstadoSolicitud,
  formatearFechaSolicitud,
  urlGoogleMapsUbicacion,
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
  /** En la vista del usuario el título es genérico; el admin conserva el número. */
  readonly modo = input<'usuario' | 'admin'>('usuario');
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

  /** Ubicaciones ya guardadas: se muestran tal cual vinieron del backend. */
  protected readonly ubicaciones = computed(
    () => this.detalle().ubicaciones ?? [],
  );

  /**
   * Enlace público construido solo con los datos persistidos. No consulta
   * Places ni Geocoding al abrir el detalle.
   */
  protected urlMapa(
    ubicacion: UbicacionGuardadaSolicitudEmpleadorDTO,
  ): string | null {
    return urlGoogleMapsUbicacion(ubicacion);
  }
}
