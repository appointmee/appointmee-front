import type {
  NotificacionDTO,
  TipoNotificacion,
} from '../../models/notificacion';

/** A dónde lleva una notificación al abrirla. */
export type DestinoNotificacion =
  | {
      readonly tipo: 'ruta';
      readonly ruta: string;
      readonly queryParams?: Readonly<Record<string, number>>;
    }
  | { readonly tipo: 'chat'; readonly conversacionId: number | null };

const ETIQUETAS_TIPO: Record<TipoNotificacion, string> = {
  RESERVA: 'Turno',
  CANCELACION: 'Turno cancelado',
  RECORDATORIO: 'Recordatorio de turno',
  PAGO: 'Pago',
  SISTEMA: 'Novedad de la cuenta',
  SOLICITUD: 'Solicitud',
  MENSAJE: 'Mensaje',
};

const ICONOS_TIPO: Record<TipoNotificacion, string> = {
  RESERVA: 'M7 2v4M17 2v4M3 9h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z',
  CANCELACION: 'M7 2v4M17 2v4M3 9h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z',
  RECORDATORIO: 'M7 2v4M17 2v4M3 9h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z',
  PAGO: 'M3 7h18v12H3zM3 11h18M7 15h4',
  SISTEMA: 'M12 8v5M12 17h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  SOLICITUD: 'M4 4h16v16H4zM8 9h8M8 13h8M8 17h4',
  MENSAJE: 'M21 12a8 8 0 0 1-8 8H7l-4 3V12a8 8 0 0 1 16 0Z',
};

const ICONO_SISTEMA = ICONOS_TIPO['SISTEMA'];

export function etiquetaTipoNotificacion(tipo: TipoNotificacion): string {
  return ETIQUETAS_TIPO[tipo] ?? 'Notificación';
}

export function iconoTipoNotificacion(tipo: TipoNotificacion): string {
  return ICONOS_TIPO[tipo] ?? ICONO_SISTEMA;
}

export function formatearFechaNotificacion(fecha: string | null): string {
  if (!fecha) return 'Fecha no disponible';
  const fechaParseada = new Date(fecha);
  if (Number.isNaN(fechaParseada.getTime())) return 'Fecha no disponible';
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(fechaParseada);
}

export function ariaNotificacion(notificacion: NotificacionDTO): string {
  const estado = notificacion.leida ? 'leída' : 'sin leer';
  return `${notificacion.titulo}. ${notificacion.mensaje}. ${estado}. ${formatearFechaNotificacion(notificacion.fecha)}. Abrir notificación.`;
}

/** Usa el ID del backend cuando viene; si falta, mantiene la ruta genérica por tipo. */
export function destinoDeNotificacion(
  notificacion: NotificacionDTO,
  rutaTurnos: string,
): DestinoNotificacion {
  const id = notificacion.destinoId ?? null;
  const sucursalId = notificacion.sucursalId ?? null;
  const parametros = (clave: string): Record<string, number> => {
    const valores: Record<string, number> = { [clave]: id as number };
    if (sucursalId !== null) valores['sucursalId'] = sucursalId;
    return valores;
  };

  if (id !== null && notificacion.destinoTipo) {
    switch (notificacion.destinoTipo) {
      case 'TURNO':
        return { tipo: 'ruta', ruta: rutaTurnos, queryParams: parametros('turnoId') };
      case 'PAGO':
        return { tipo: 'ruta', ruta: '/pago/resultado', queryParams: parametros('turnoId') };
      case 'SOLICITUD':
        return { tipo: 'ruta', ruta: '/solicitudes', queryParams: { solicitudId: id } };
      case 'CONVERSACION':
        return { tipo: 'chat', conversacionId: id };
    }
  }

  switch (notificacion.tipo) {
    case 'PAGO':
      return { tipo: 'ruta', ruta: '/pago/resultado' };
    case 'SOLICITUD':
      return { tipo: 'ruta', ruta: '/solicitudes' };
    case 'MENSAJE':
      return { tipo: 'chat', conversacionId: null };
    case 'RESERVA':
    case 'CANCELACION':
    case 'RECORDATORIO':
      return { tipo: 'ruta', ruta: rutaTurnos };
    default:
      return { tipo: 'ruta', ruta: '/configuracion' };
  }
}
