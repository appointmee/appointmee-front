import { mensajeErrorSolicitud } from './solicitud-empleador-errors';

export type ContextoSolicitudEmpleado =
  | 'carga'
  | 'detalle'
  | 'resolucion'
  | 'envio'
  | 'auto-incorporacion'
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
    contexto === 'busqueda' || contexto === 'sucursales'
      ? 'carga'
      : contexto === 'auto-incorporacion'
        ? 'envio'
        : contexto;
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

  if (contexto === 'auto-incorporacion') {
    if (mensaje === 'Revisá el comentario ingresado e intentá nuevamente.') {
      return 'No pudimos agregarte como empleado. Revisá los datos e intentá nuevamente.';
    }
    return mensaje.replace('enviar la solicitud', 'agregarte como empleado');
  }

  return mensaje;
}
