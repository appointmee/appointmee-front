import type { MensajeChat } from '../models/chat';
import { fusionarMensajes, urlWebSocketDesde } from './chat-realtime-service';

function mensaje(id: number, clienteMensajeId = `uuid-${id}`): MensajeChat {
  return {
    id,
    conversacionId: 50,
    autorId: 1,
    autorNombre: 'Cliente',
    contenido: `hola ${id}`,
    fechaCreacion: null,
    estadoEntrega: 'ENVIADO',
    clienteMensajeId,
  };
}

describe('chatRealtimeService (helpers)', () => {
  it('deriva la URL ws/wss desde la URL del backend', () => {
    expect(urlWebSocketDesde('http://localhost:8080')).toBe('ws://localhost:8080/ws');
    expect(urlWebSocketDesde('https://api.example.com/')).toBe('wss://api.example.com/ws');
  });

  it('no duplica mensajes repetidos por idCliente', () => {
    const resultado = fusionarMensajes([mensaje(1)], [mensaje(1), mensaje(2)]);

    expect(resultado.map((m) => m.id)).toEqual([1, 2]);
  });

  it('descarta reintentos con distinto id pero el mismo clienteMensajeId', () => {
    const original = mensaje(1, 'uuid-unico');
    const reintento = { ...mensaje(2, 'uuid-unico'), contenido: 'hola 1' };

    expect(fusionarMensajes([original], [reintento])).toEqual([original]);
  });

  it('ordena por id aunque lleguen desordenados', () => {
    const resultado = fusionarMensajes([mensaje(3)], [mensaje(1), mensaje(2)]);

    expect(resultado.map((m) => m.id)).toEqual([1, 2, 3]);
  });
});
