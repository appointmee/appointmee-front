/** Estados reales expuestos por el backend (`EstadoSolicitud`). */
export type EstadoSolicitudEmpleador = 'PENDIENTE' | 'APROBADA' | 'RECHAZADA';

/**
 * DTO reducido que devuelven `/solicitudes-empleador/propias` y
 * `/solicitudes-empleador/listar`. No incluye el estado ni el motivo.
 */
export interface SolicitudEmpleadorMiniDTO {
  readonly id: number;
  readonly nombreUsuario: string;
  readonly apellidoUsuario: string;
  readonly fechaSolicitud: string;
}

export interface UsuarioSolicitudEmpleadorDTO {
  readonly id: number;
  readonly nombre: string;
  readonly apellido: string;
  readonly email: string;
  readonly urlFotoPerfil: string | null;
}

/** Respuesta de `/solicitudes-empleador/{id}/detalles`. */
export interface SolicitudEmpleadorDetalleDTO {
  readonly id: number;
  readonly motivo: string;
  readonly estado: EstadoSolicitudEmpleador;
  readonly fechaSolicitud: string;
  readonly usuario: UsuarioSolicitudEmpleadorDTO;
}

export interface SolicitudEmpleadorCrearDTO {
  readonly motivo: string;
}

export const ETIQUETAS_ESTADO_SOLICITUD: Readonly<Record<EstadoSolicitudEmpleador, string>> = {
  PENDIENTE: 'Pendiente',
  APROBADA: 'Aprobada',
  RECHAZADA: 'Rechazada',
};

export function etiquetaEstadoSolicitud(estado: EstadoSolicitudEmpleador | null | undefined): string {
  return estado ? ETIQUETAS_ESTADO_SOLICITUD[estado] : 'Estado a consultar';
}

export function claseEstadoSolicitud(estado: EstadoSolicitudEmpleador | null | undefined): string {
  return estado ? `estado--${estado.toLowerCase()}` : 'estado--desconocido';
}

/** Las fechas del backend son LocalDate (`YYYY-MM-DD`), sin hora ni zona. */
export function formatearFechaSolicitud(fecha: string | null | undefined): string {
  const valor = fecha?.trim();
  if (!valor) return 'Fecha sin informar';

  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  if (!partes) return valor;

  const [, anio, mes, dia] = partes;
  const fechaLocal = new Date(Number(anio), Number(mes) - 1, Number(dia));

  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(fechaLocal);
}

export function inicialesSolicitante(nombre: string, apellido: string): string {
  return `${nombre.trim().charAt(0)}${apellido.trim().charAt(0)}`.toUpperCase() || 'AM';
}
