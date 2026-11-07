import {
  EstadoSolicitudEmpleador,
  claseEstadoSolicitud,
  etiquetaEstadoSolicitud,
  formatearFechaSolicitud,
  inicialesSolicitante,
} from './solicitud-empleador';

/** El backend comparte `EstadoSolicitud` para ambos flujos de solicitudes. */
export type EstadoSolicitudEmpleado = EstadoSolicitudEmpleador;
export type TipoSolicitudEmpleado = 'recibida' | 'enviada';
export type AccionSolicitudEmpleado = 'aprobar' | 'rechazar';

export {
  claseEstadoSolicitud as claseEstadoSolicitudEmpleado,
  etiquetaEstadoSolicitud as etiquetaEstadoSolicitudEmpleado,
  formatearFechaSolicitud as formatearFechaSolicitudEmpleado,
};

/**
 * DTO reducido de `/solicitudes-empleado/recibidas`.
 * No incluye el estado: se consulta en el detalle.
 */
export interface SolicitudEmpleadoMiniPropiaDTO {
  readonly id: number;
  readonly nombreSucursal: string;
  readonly fechaSolicitud: string;
}

/**
 * DTO reducido de `/solicitudes-empleado/enviadas/sucursal/{id}`.
 * No incluye el estado: se consulta en el detalle.
 */
export interface SolicitudEmpleadoMiniSucursalDTO {
  readonly id: number;
  readonly nombreEmpleado: string;
  readonly apellidoEmpleado: string;
  readonly fechaSolicitud: string;
}

export interface UsuarioSolicitudEmpleadoDTO {
  readonly id: number;
  readonly nombre: string;
  readonly apellido: string;
  readonly email: string;
  readonly urlFotoPerfil: string | null;
}

export interface SucursalSolicitudEmpleadoDTO {
  readonly id: number;
  readonly nombre: string;
  readonly categoria: string;
  readonly fotoPerfil: string | null;
  readonly puntuacion: number | null;
  readonly cantidadPuntuaciones: number;
  readonly diasApertura?: readonly string[];
}

/** Respuesta de `/solicitudes-empleado/{id}/detalles`. */
export interface SolicitudEmpleadoDetalleDTO {
  readonly id: number;
  readonly estadoSolicitud: EstadoSolicitudEmpleado;
  readonly fechaSolicitud: string;
  readonly empleado: UsuarioSolicitudEmpleadoDTO;
  readonly sucursal: SucursalSolicitudEmpleadoDTO;
}

/**
 * Datos mínimos que necesita una tarjeta, sin importar si la solicitud fue
 * recibida o enviada. Evita ramificar la vista por cada DTO reducido.
 */
export interface SolicitudEmpleadoVista {
  readonly id: number;
  readonly titulo: string;
  readonly subtitulo: string;
  readonly iniciales: string;
  readonly fechaSolicitud: string;
}

export interface ResultadoResolucionSolicitudEmpleado {
  readonly id: number;
  readonly estado: EstadoSolicitudEmpleado;
  readonly accion: AccionSolicitudEmpleado;
}

export function inicialesDeTexto(texto: string): string {
  const palabras = texto.trim().split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return 'AM';

  const iniciales =
    palabras.length > 1
      ? `${palabras[0].charAt(0)}${palabras[1].charAt(0)}`
      : palabras[0].slice(0, 2);

  return iniciales.toUpperCase();
}

export function vistaSolicitudRecibida(
  solicitud: SolicitudEmpleadoMiniPropiaDTO,
): SolicitudEmpleadoVista {
  const nombreSucursal = solicitud.nombreSucursal?.trim() || 'Sucursal';

  return {
    id: solicitud.id,
    titulo: nombreSucursal,
    subtitulo: 'Invitación de la sucursal',
    iniciales: inicialesDeTexto(nombreSucursal),
    fechaSolicitud: solicitud.fechaSolicitud,
  };
}

export function vistaSolicitudEnviada(
  solicitud: SolicitudEmpleadoMiniSucursalDTO,
): SolicitudEmpleadoVista {
  const nombre = `${solicitud.nombreEmpleado ?? ''} ${solicitud.apellidoEmpleado ?? ''}`.trim();

  return {
    id: solicitud.id,
    titulo: nombre || 'Empleado invitado',
    subtitulo: 'Invitación enviada',
    iniciales: inicialesSolicitante(
      solicitud.nombreEmpleado ?? '',
      solicitud.apellidoEmpleado ?? '',
    ),
    fechaSolicitud: solicitud.fechaSolicitud,
  };
}

/** Las categorías del backend llegan como enum en mayúsculas con guiones bajos. */
export function humanizarCategoria(categoria: string | null | undefined): string {
  if (!categoria) return '';
  return categoria
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letra) => letra.toUpperCase());
}
