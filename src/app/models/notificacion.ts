/** Categorías que el backend puede enviar en una notificación in-app. */
export type TipoNotificacion =
  | 'RESERVA'
  | 'CANCELACION'
  | 'RECORDATORIO'
  | 'PAGO'
  | 'SISTEMA'
  | 'SOLICITUD'
  | 'MENSAJE';

/** DTO que devuelve el listado paginado de notificaciones del usuario autenticado. */
/** Entidad concreta a la que lleva una notificación cuando el backend la informa. */
export type TipoDestinoNotificacion = 'TURNO' | 'PAGO' | 'SOLICITUD' | 'CONVERSACION';

export interface NotificacionDTO {
  readonly id: number;
  readonly tipo: TipoNotificacion;
  readonly titulo: string;
  readonly mensaje: string;
  readonly fecha: string | null;
  readonly leida: boolean;
  /** Opcional: notificaciones anteriores no tenían destino concreto. */
  readonly destinoTipo?: TipoDestinoNotificacion | null;
  readonly destinoId?: number | null;
  readonly sucursalId?: number | null;
}

export interface PaginaNotificacionesDTO {
  readonly contenido: readonly NotificacionDTO[];
  readonly pagina: number;
  readonly tamano: number;
  readonly totalElementos: number;
  readonly totalPaginas: number;
  readonly noLeidas: number;
}

export interface ContadorNoLeidasDTO {
  readonly noLeidas: number;
}

/** 'TODOS' indica que no se envía el parámetro de tipo al backend. */
export type FiltroTipoNotificacion = TipoNotificacion | 'TODOS';

/** 'TODAS' indica que no se envía el parámetro de estado de lectura. */
export type FiltroLecturaNotificacion = 'TODAS' | 'NO_LEIDAS' | 'LEIDAS';
