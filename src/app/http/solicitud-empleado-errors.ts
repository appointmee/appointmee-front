import { mensajeErrorSolicitud } from './solicitud-empleador-errors';

export type ContextoSolicitudEmpleado =
  | 'carga'
  | 'detalle'
  | 'resolucion'
  | 'envio'
  | 'busqueda'
  | 'sucursales';

/**
 * Reutiliza el mapeo de errores de solicitudes y ajusta el texto del listado
 * para las invitaciones de empleo.
 */
export function mensajeErrorSolicitudEmpleado(
  error: unknown,
  contexto: ContextoSolicitudEmpleado,
): string {
  const contextoBase =
    contexto === 'busqueda' || contexto === 'sucursales' ? 'carga' : contexto;
  const mensaje = mensajeErrorSolicitud(error, contextoBase);

  if (contexto === 'carga') {
    return mensaje.replace('tus solicitudes', 'tus solicitudes de empleo');
  }

  if (contexto === 'busqueda') {
    return mensaje.replace('tus solicitudes', 'el usuario');
  }

  if (contexto === 'sucursales') {
    return mensaje.replace('tus solicitudes', 'tus sucursales');
  }

  return mensaje;
}
