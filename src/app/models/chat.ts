export type EstadoEntregaChat = 'ENVIADO' | 'ENTREGADO' | 'LEIDO';

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
