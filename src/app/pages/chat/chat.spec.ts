import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { signal, type WritableSignal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';

import type {
  ConversacionDetalleChat,
  ConversacionResumenChat,
  MensajeChat,
} from '../../models/chat';
import { chatRealtimeService } from '../../services/chat-realtime-service';

import { Chat } from './chat';

const CONVERSACIONES: ConversacionResumenChat[] = [
  {
    id: 50,
    sucursalId: 7,
    sucursalNombre: 'Sucursal Centro',
    turnoId: 12,
    fechaCreacion: '2026-11-20T09:00:00',
    ultimoMensaje: 'Nos vemos mañana',
    ultimoMensajeFecha: '2026-11-24T18:30:00',
    noLeidos: 2,
    interlocutor: 'Ana Pérez',
    rol: 'CLIENTE',
    servicioNombre: 'Corte de cabello',
    clienteNombre: 'Gonzalo López',
    profesionalNombre: 'Ana Pérez',
  },
  {
    id: 51,
    sucursalId: 9,
    sucursalNombre: 'Sucursal Norte',
    turnoId: 13,
    fechaCreacion: '2026-11-21T09:00:00',
    ultimoMensaje: null,
    ultimoMensajeFecha: null,
    noLeidos: 0,
    interlocutor: 'Luis Gómez',
    rol: 'EMPLEADO',
    servicioNombre: null,
    clienteNombre: 'María Ruiz',
    profesionalNombre: 'Luis Gómez',
  },
];

const DETALLE: ConversacionDetalleChat = {
  id: 50,
  sucursalId: 7,
  sucursalNombre: 'Sucursal Centro',
  turnoId: 12,
  fechaCreacion: '2026-11-20T09:00:00',
  participantes: [
    { usuarioId: 1, nombre: 'Gonzalo', apellido: 'López', rol: 'CLIENTE' },
    { usuarioId: 2, nombre: 'Ana', apellido: 'Pérez', rol: 'EMPLEADO' },
  ],
};

function mensaje(
  id: number,
  overrides: Partial<MensajeChat> = {},
): MensajeChat {
  return {
    id,
    conversacionId: 50,
    autorId: 2,
    autorNombre: 'Ana Pérez',
    contenido: `Mensaje ${id}`,
    fechaCreacion: '2026-11-24T18:00:00',
    estadoEntrega: 'ENVIADO',
    clienteMensajeId: `uuid-${id}`,
    ...overrides,
  };
}

const HISTORIAL: MensajeChat[] = [
  mensaje(1),
  mensaje(2, { autorId: 1, autorNombre: 'Gonzalo López', estadoEntrega: 'ENTREGADO' }),
  mensaje(3, { estadoEntrega: 'LEIDO' }),
];

type RealtimeStub = {
  mensajes: WritableSignal<MensajeChat[]>;
  conectado: WritableSignal<boolean>;
  conectar: ReturnType<typeof vi.fn>;
  desconectar: ReturnType<typeof vi.fn>;
  enviar: ReturnType<typeof vi.fn>;
};

describe('Chat (US-CHAT-04)', () => {
  let fixture: ComponentFixture<Chat>;
  let backend: HttpTestingController;
  let html: HTMLElement;
  let realtime: RealtimeStub;

  beforeEach(async () => {
    realtime = {
      mensajes: signal<MensajeChat[]>([]),
      conectado: signal(true),
      conectar: vi.fn(),
      desconectar: vi.fn(),
      enviar: vi.fn(() => true),
    };

    await TestBed.configureTestingModule({
      imports: [Chat],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: chatRealtimeService, useValue: realtime },
      ],
    }).compileComponents();

    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Chat);
    html = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    backend.verify();
    vi.restoreAllMocks();
  });

  function flushLista(lista: ConversacionResumenChat[] = CONVERSACIONES): void {
    backend.expectOne((request) => request.url.endsWith('/conversaciones')).flush(lista);
    fixture.detectChanges();
  }

  function abrirPrimeraConversacion(
    historial: MensajeChat[] = HISTORIAL,
    detalle: ConversacionDetalleChat = DETALLE,
  ): void {
    const boton = html.querySelector<HTMLButtonElement>('button.conversacion');
    expect(boton).toBeTruthy();
    boton!.click();
    fixture.detectChanges();

    backend
      .expectOne((request) => request.url.endsWith('/conversaciones/50') && request.method === 'GET')
      .flush(detalle);
    backend
      .expectOne((request) => request.url.includes('/conversaciones/50/mensajes'))
      .flush(historial);
    backend
      .expectOne((request) => request.url.endsWith('/conversaciones/50/leido'))
      .flush({});
    fixture.detectChanges();
  }

  function escribir(texto: string): void {
    const textarea = html.querySelector<HTMLTextAreaElement>('textarea')!;
    textarea.value = texto;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
  }

  function enviar(): void {
    html.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();
  }

  it('muestra el local, el servicio, el cliente, el profesional y los no leídos', () => {
    expect(html.querySelector('[aria-busy="true"]')).toBeTruthy();

    flushLista();

    const botones = Array.from(html.querySelectorAll<HTMLButtonElement>('button.conversacion'));
    expect(botones).toHaveLength(2);
    expect(botones[0]!.textContent).toContain('Sucursal Centro · Corte de cabello');
    expect(botones[0]!.textContent).toContain('Cliente: Gonzalo López · Profesional: Ana Pérez');
    expect(botones[0]!.textContent).toContain('Nos vemos mañana');
    expect(botones[0]!.querySelector('.conversacion__no-leidos')?.textContent).toContain('2');
    expect(botones[0]!.getAttribute('aria-label')).toContain('2 mensajes no leídos');
    expect(botones[0]!.getAttribute('aria-label')).toContain('Profesional: Ana Pérez');
    expect(botones[1]!.textContent).toContain('Sucursal Norte · Reserva #13');
    expect(botones[1]!.textContent).toContain('Profesional: Luis Gómez');
    expect(botones[1]!.textContent).toContain('Sin mensajes');
  });

  it('muestra "Consulta general" cuando la conversación no tiene turno', () => {
    flushLista([
      {
        ...CONVERSACIONES[0]!,
        id: 52,
        turnoId: null,
        servicioNombre: null,
        clienteNombre: null,
        profesionalNombre: null,
        sucursalNombre: 'Sucursal Oeste',
      },
    ]);

    const boton = html.querySelector<HTMLButtonElement>('button.conversacion')!;
    expect(boton.textContent).toContain('Sucursal Oeste · Consulta general');
    expect(boton.textContent).not.toContain('Cliente:');
  });

  it('muestra el estado vacío cuando no hay conversaciones', () => {
    flushLista([]);

    expect(html.textContent).toContain('Todavía no tenés conversaciones');
    expect(html.querySelector('[role="status"]')).toBeTruthy();
  });

  it('explica la ventana de chat en el listado', () => {
    flushLista();

    expect(html.querySelector('.conversaciones__ayuda')?.textContent).toContain(
      'durante el turno y hasta 3 días después',
    );
  });

  it('explica que la conversación venció cuando el backend responde 403', () => {
    backend.expectOne((request) => request.url.endsWith('/conversaciones')).flush(
      { message: 'boom' },
      { status: 403, statusText: 'Forbidden' },
    );
    fixture.detectChanges();

    expect(html.querySelector('[role="alert"]')?.textContent).toContain(
      'ya no está disponible',
    );
    expect(html.textContent).not.toContain('boom');
  });

  it('muestra el error inline de la lista y reintenta conservando el contexto', () => {
    backend.expectOne((request) => request.url.endsWith('/conversaciones')).flush(
      { message: 'boom' },
      { status: 500, statusText: 'Server Error' },
    );
    fixture.detectChanges();

    const alerta = html.querySelector<HTMLElement>('[role="alert"]')!;
    expect(alerta.textContent).toContain('No pudimos cargar tus conversaciones');
    expect(alerta.textContent).not.toContain('boom');

    const reintentar = alerta.querySelector<HTMLButtonElement>('button')!;
    reintentar.click();
    backend.expectOne((request) => request.url.endsWith('/conversaciones')).flush(CONVERSACIONES);
    fixture.detectChanges();

    expect(html.querySelectorAll('button.conversacion')).toHaveLength(2);
  });

  it('abre una conversación, muestra el historial y la marca como leída', () => {
    flushLista();
    abrirPrimeraConversacion();

    expect(realtime.desconectar).toHaveBeenCalled();
    expect(realtime.conectar).toHaveBeenCalledWith(50, 3);
    expect(html.querySelectorAll('li.mensaje')).toHaveLength(3);
    expect(html.querySelector('.conversacion--activa')).toBeTruthy();
    expect(
      html.querySelector('button.conversacion')?.getAttribute('aria-current'),
    ).toBe('true');
    expect(html.querySelector('#hilo-titulo')?.textContent).toContain(
      'Sucursal Centro · Corte de cabello',
    );
    expect(html.querySelector('.hilo__titulo p')?.textContent).toContain(
      'Cliente: Gonzalo López · Profesional: Ana Pérez',
    );
  });

  it('muestra fecha, autor y estado de entrega con texto, no solo con color', () => {
    flushLista();
    abrirPrimeraConversacion();

    const mensajes = Array.from(html.querySelectorAll<HTMLElement>('li.mensaje'));
    expect(mensajes[0]!.textContent).toContain('Ana Pérez');
    expect(mensajes[0]!.textContent).toContain('Enviado');
    expect(mensajes[1]!.textContent).toContain('Entregado');
    expect(mensajes[2]!.textContent).toContain('Leído');
    expect(mensajes[0]!.querySelector('time')?.getAttribute('datetime')).toBe(
      '2026-11-24T18:00:00',
    );
  });

  it('valida el campo vacío, muestra el error y mueve el foco al textarea', () => {
    flushLista();
    abrirPrimeraConversacion();

    enviar();

    const error = html.querySelector<HTMLElement>('#chat-mensaje-error');
    expect(error?.textContent).toContain('Escribí un mensaje');
    expect(html.querySelector('textarea')?.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(html.querySelector('textarea'));
    expect(realtime.enviar).not.toHaveBeenCalled();
  });

  it('bloquea envíos duplicados y los habilita cuando llega el eco del backend', () => {
    flushLista();
    abrirPrimeraConversacion();

    escribir('¿Seguimos mañana?');
    enviar();
    expect(realtime.enviar).toHaveBeenCalledTimes(1);
    expect(realtime.enviar).toHaveBeenCalledWith('¿Seguimos mañana?');

    escribir('¿Seguimos mañana?');
    enviar();
    expect(realtime.enviar).toHaveBeenCalledTimes(1);

    realtime.mensajes.set([...HISTORIAL, mensaje(4, { contenido: '¿Seguimos mañana?' })]);
    fixture.detectChanges();

    escribir('Gracias');
    enviar();
    expect(realtime.enviar).toHaveBeenCalledTimes(2);
  });

  it('muestra un error inline si la publicación falla', () => {
    realtime.enviar.mockReturnValue(false);
    flushLista();
    abrirPrimeraConversacion();

    escribir('Hola');
    enviar();

    expect(html.querySelector('[role="alert"]')?.textContent).toContain('No se pudo enviar');
  });

  it('no envía sin conexión y avisa inline', () => {
    const original = Object.getOwnPropertyDescriptor(Navigator.prototype, 'onLine');
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    try {
      flushLista();
      abrirPrimeraConversacion();

      escribir('Hola');
      enviar();

      expect(realtime.enviar).not.toHaveBeenCalled();
      expect(html.textContent).toContain('Sin conexión');
    } finally {
      if (original) Object.defineProperty(navigator, 'onLine', original);
      else delete (navigator as { onLine?: boolean }).onLine;
    }
  });

  it('muestra error de historial con reintento que conserve la conversación', () => {
    flushLista();
    const boton = html.querySelector<HTMLButtonElement>('button.conversacion')!;
    boton.click();
    fixture.detectChanges();

    backend
      .expectOne((request) => request.url.endsWith('/conversaciones/50') && request.method === 'GET')
      .flush(DETALLE);
    backend
      .expectOne((request) => request.url.includes('/conversaciones/50/mensajes'))
      .flush({ message: 'boom' }, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(html.textContent).toContain('No pudimos cargar el historial');

    const reintentar = Array.from(html.querySelectorAll<HTMLButtonElement>('button')).find(
      (elemento) => elemento.textContent?.trim() === 'Reintentar',
    )!;
    reintentar.click();
    backend
      .expectOne((request) => request.url.includes('/conversaciones/50/mensajes'))
      .flush(HISTORIAL);
    fixture.detectChanges();

    expect(html.querySelectorAll('li.mensaje')).toHaveLength(3);
    expect(realtime.conectar).toHaveBeenCalledWith(50, 3);
  });

  it('permite volver al listado desde el hilo con teclado', () => {
    flushLista();
    abrirPrimeraConversacion();

    const volver = html.querySelector<HTMLButtonElement>('.hilo__volver')!;
    expect(volver.getAttribute('aria-label')).toBe('Volver al listado de conversaciones');
    volver.focus();
    volver.click();
    fixture.detectChanges();

    expect(realtime.desconectar).toHaveBeenCalledTimes(2);
    expect(html.querySelector('#hilo-titulo')?.textContent).toContain('Elegí una conversación');
    expect(html.querySelectorAll('button.conversacion')).toHaveLength(2);
  });
});
