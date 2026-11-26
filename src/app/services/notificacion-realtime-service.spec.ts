import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Client } from '@stomp/stompjs';

import { authService } from './auth-service';
import { destinoNotificaciones, notificacionRealtimeService } from './notificacion-realtime-service';
import { notificacionesCambiosService } from './notificaciones-cambios-service';

const mocks = vi.hoisted(() => ({
  activate: vi.fn(),
  deactivate: vi.fn(),
  subscribe: vi.fn(),
  onConnect: null as null | (() => void),
}));

vi.mock('@stomp/stompjs', () => ({
  Client: vi.fn().mockImplementation(function (config: { onConnect: () => void }) {
    mocks.onConnect = config.onConnect;
    return {
      activate: mocks.activate,
      deactivate: mocks.deactivate,
      subscribe: mocks.subscribe,
      connected: true,
    };
  }),
}));

describe('notificacionRealtimeService (STOMP)', () => {
  const perfil = signal<{ email: string } | null>(null);
  let servicio: notificacionRealtimeService;
  let cambios: notificacionesCambiosService;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.onConnect = null;
    perfil.set(null);

    TestBed.configureTestingModule({
      providers: [
        {
          provide: authService,
          useValue: { getAccessToken: () => 'token', perfil },
        },
      ],
    });
    servicio = TestBed.inject(notificacionRealtimeService);
    cambios = TestBed.inject(notificacionesCambiosService);
  });

  it('deriva el canal privado desde el email normalizado', () => {
    expect(destinoNotificaciones(' Gonza@Example.com ')).toBe(
      '/topic/notificaciones/gonza@example.com',
    );
  });

  it('no conecta sin sesión autenticada', () => {
    servicio.conectar();

    expect(Client).not.toHaveBeenCalled();
    expect(servicio.conectado()).toBe(false);
  });

  it('avisa a las vistas cuando llega una notificación por STOMP', () => {
    perfil.set({ email: 'gonza@example.com' });
    const version = cambios.version();

    servicio.conectar();
    mocks.onConnect?.();

    expect(mocks.activate).toHaveBeenCalledOnce();
    expect(mocks.subscribe).toHaveBeenCalledWith(
      '/topic/notificaciones/gonza@example.com',
      expect.any(Function),
    );

    const recibir = mocks.subscribe.mock.calls[0][1] as (frame: { body: string }) => void;
    recibir({
      body: JSON.stringify({
        id: 1,
        tipo: 'RESERVA',
        titulo: 'Turno confirmado',
        mensaje: 'Tu turno fue confirmado.',
        fecha: null,
        leida: false,
      }),
    });

    expect(cambios.version()).toBe(version + 1);
    expect(servicio.ultima()?.titulo).toBe('Turno confirmado');
  });

  it('ignora frames malformados sin romper la suscripción', () => {
    perfil.set({ email: 'gonza@example.com' });
    const version = cambios.version();

    servicio.conectar();
    mocks.onConnect?.();
    const recibir = mocks.subscribe.mock.calls[0][1] as (frame: { body: string }) => void;
    recibir({ body: 'no-es-json' });

    expect(cambios.version()).toBe(version);
    expect(servicio.ultima()).toBeNull();
  });
});
