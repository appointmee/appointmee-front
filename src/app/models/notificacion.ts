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
export interface NotificacionDTO {
  readonly id: number;
  readonly tipo: TipoNotificacion;
  readonly titulo: string;
  readonly mensaje: string;
  readonly fecha: string | null;
  readonly leida: boolean;
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
