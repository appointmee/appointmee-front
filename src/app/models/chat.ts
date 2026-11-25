export type EstadoEntregaChat = 'ENVIADO' | 'ENTREGADO' | 'LEIDO';

/** El rol se deriva del turno: quien lo solicitó es cliente, quien lo atiende es empleado. */
export type RolEnConversacion = 'CLIENTE' | 'EMPLEADO';

export interface ParticipanteChat {
  usuarioId: number;
  nombre: string;
  apellido: string;
  rol: RolEnConversacion;
}

/** DTO que devuelve el listado de conversaciones del usuario autenticado. */
export interface ConversacionResumenChat {
  id: number;
  sucursalId: number;
  sucursalNombre: string;
  turnoId: number | null;
  fechaCreacion: string | null;
  ultimoMensaje: string | null;
  ultimoMensajeFecha: string | null;
  noLeidos: number;
  /** Ya calculado por el backend: el otro participante, según el rol de quien consulta. */
  interlocutor: string;
  rol: RolEnConversacion;
}

export interface ConversacionDetalleChat {
  id: number;
  sucursalId: number;
  sucursalNombre: string;
  turnoId: number | null;
  fechaCreacion: string | null;
  participantes: ParticipanteChat[];
}

export interface MensajeChat {
  id: number;
  conversacionId: number;
  autorId: number;
  autorNombre: string;
  contenido: string;
  fechaCreacion: string | null;
  estadoEntrega: EstadoEntregaChat;
  clienteMensajeId: string;
}
