import { TestBed } from '@angular/core/testing';

import { chatWidgetService } from './chat-widget-service';

describe('chatWidgetService', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('empieza cerrado y abre, cierra y alterna el estado', () => {
    const servicio = TestBed.inject(chatWidgetService);

    expect(servicio.abierto()).toBe(false);

    servicio.abrir();
    expect(servicio.abierto()).toBe(true);

    servicio.cerrar();
    expect(servicio.abierto()).toBe(false);

    servicio.toggle();
    expect(servicio.abierto()).toBe(true);
    expect(servicio.debeEnfocar()).toBe(true);

    servicio.consumirEnfoque();
    expect(servicio.debeEnfocar()).toBe(false);

    servicio.abrirConEnfoque();
    expect(servicio.abierto()).toBe(true);
    expect(servicio.debeEnfocar()).toBe(true);

    servicio.toggle();
    expect(servicio.abierto()).toBe(false);
    expect(servicio.debeEnfocar()).toBe(false);
  });

  it('guarda la conversación pedida por una notificación y la limpia al cerrar', () => {
    const servicio = TestBed.inject(chatWidgetService);

    expect(servicio.conversacionId()).toBeNull();

    servicio.abrirConversacion(99);
    expect(servicio.abierto()).toBe(true);
    expect(servicio.conversacionId()).toBe(99);

    servicio.consumirConversacion();
    expect(servicio.conversacionId()).toBeNull();

    servicio.abrirConversacion(12);
    servicio.cerrar();
    expect(servicio.conversacionId()).toBeNull();
  });
});
