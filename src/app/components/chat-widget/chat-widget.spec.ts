import { signal, type WritableSignal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { authService } from '../../services/auth-service';
import { chatService } from '../../services/chat-service';
import { chatRealtimeService } from '../../services/chat-realtime-service';
import { chatWidgetService } from '../../services/chat-widget-service';

import { ChatWidget } from './chat-widget';

describe('ChatWidget flotante (US-CHAT-04)', () => {
  let roles: WritableSignal<string[]>;
  let autenticado: WritableSignal<boolean>;
  let widget: chatWidgetService;
  let fixture: ComponentFixture<ChatWidget>;
  let html: HTMLElement;
  let reducirMovimiento: boolean;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    sessionStorage.clear();
    reducirMovimiento = false;
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: reducirMovimiento })));
    roles = signal<string[]>(['CLIENTE']);
    autenticado = signal(true);

    await TestBed.configureTestingModule({
      imports: [ChatWidget],
      providers: [
        {
          provide: authService,
          useValue: {
            autenticado,
            tieneAlgunRol: (...solicitados: string[]) =>
              solicitados.some((rol) => roles().includes(rol)),
          },
        },
        { provide: chatService, useValue: { listar: () => of([]) } },
        {
          provide: chatRealtimeService,
          useValue: {
            mensajes: signal([]),
            conectado: signal(false),
            conectar: vi.fn(),
            desconectar: vi.fn(),
            enviar: vi.fn(() => true),
          },
        },
      ],
    }).compileComponents();

    widget = TestBed.inject(chatWidgetService);
    fixture = TestBed.createComponent(ChatWidget);
    html = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  function burbuja(): HTMLButtonElement {
    return html.querySelector<HTMLButtonElement>('.chat-widget__burbuja')!;
  }

  function terminarAbeja(contenedor: HTMLElement, animationName: string): void {
    const abeja = contenedor.querySelector('.abeja');
    const fin = new Event('animationend', { bubbles: true });
    Object.defineProperty(fin, 'animationName', { value: animationName });
    abeja?.dispatchEvent(fin);
  }

  it('muestra la burbuja solo para usuarios autenticados con roles de chat', () => {
    expect(burbuja()).toBeTruthy();
    expect(burbuja().getAttribute('aria-label')).toBe('Abrir mensajes');
    expect(burbuja().querySelector('.chat-widget__logo ellipse')).toBeTruthy();
    expect(burbuja().querySelector('.chat-widget__logo path')).toBeTruthy();
    expect(html.querySelector('[role="dialog"]')).toBeNull();

    roles.set(['ADMINISTRADOR']);
    fixture.detectChanges();
    expect(burbuja()).toBeNull();

    roles.set([]);
    autenticado.set(false);
    fixture.detectChanges();
    expect(burbuja()).toBeNull();
  });

  it('abre el panel con el chat dentro y mueve el foco al cierre', () => {
    burbuja().click();
    fixture.detectChanges();

    const panel = html.querySelector<HTMLElement>('[role="dialog"]')!;
    expect(panel.getAttribute('aria-label')).toBe('Mensajes');
    expect(panel.querySelector('app-chat')).toBeTruthy();
    expect(panel.querySelector('h2')?.textContent?.trim()).toBe('Mensajes');
    expect(widget.abierto()).toBe(true);
    expect(burbuja().getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(panel.querySelector('.chat-widget__cerrar'));
  });

  it('cierra con el botón y devuelve el foco a la burbuja', () => {
    burbuja().click();
    fixture.detectChanges();

    const cerrar = html.querySelector<HTMLButtonElement>('.chat-widget__cerrar')!;
    cerrar.click();
    fixture.detectChanges();

    expect(widget.abierto()).toBe(false);
    expect(html.querySelector('[role="dialog"]')).toBeNull();
    expect(html.querySelector('app-chat')).toBeNull();
    expect(document.activeElement).toBe(burbuja());
  });

  it('cierra con Escape y devuelve el foco a la burbuja', () => {
    burbuja().click();
    fixture.detectChanges();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();

    expect(widget.abierto()).toBe(false);
    expect(html.querySelector('app-chat')).toBeNull();
    expect(document.activeElement).toBe(burbuja());
  });

  it('la burbuja alterna apertura y cierre', () => {
    burbuja().click();
    fixture.detectChanges();
    expect(widget.abierto()).toBe(true);
    expect(burbuja().getAttribute('aria-label')).toBe('Cerrar mensajes');

    burbuja().click();
    fixture.detectChanges();
    expect(widget.abierto()).toBe(false);
    expect(burbuja().getAttribute('aria-label')).toBe('Abrir mensajes');
  });

  it('la abeja vuela al arrancar y dice bzz bzz una vez por sesión', () => {
    const abeja = html.querySelector('.abeja');
    expect(abeja).toBeTruthy();
    expect(abeja?.textContent).toContain('bzz bzz');
    expect(sessionStorage.getItem('appointmee.chat-abeja-vista')).toBeNull();

    terminarAbeja(html, 'abeja-bzz');
    fixture.detectChanges();
    expect(sessionStorage.getItem('appointmee.chat-abeja-vista')).toBe('1');

    fixture.destroy();
    const otra = TestBed.createComponent(ChatWidget);
    otra.detectChanges();
    expect(otra.nativeElement.querySelector('.abeja')).toBeNull();
    otra.destroy();
  });

  it('oculta la abeja cuando termina el bzz bzz', () => {
    terminarAbeja(html, 'abeja-vuelo');
    fixture.detectChanges();
    expect(html.querySelector('.abeja')).toBeTruthy();

    terminarAbeja(html, 'abeja-bzz');
    fixture.detectChanges();
    expect(html.querySelector('.abeja')).toBeNull();
  });

  it('?abeja=1 fuerza la animación aunque ya se vio en la sesión', () => {
    sessionStorage.setItem('appointmee.chat-abeja-vista', '1');
    window.history.replaceState({}, '', '/?abeja=1');

    fixture.destroy();
    const otra = TestBed.createComponent(ChatWidget);
    otra.detectChanges();

    expect(otra.nativeElement.querySelector('.abeja')).toBeTruthy();
    otra.destroy();
    window.history.replaceState({}, '', '/');
  });

  it('no muestra la abeja con prefers-reduced-motion', () => {
    fixture.destroy();
    sessionStorage.clear();
    reducirMovimiento = true;

    const otra = TestBed.createComponent(ChatWidget);
    otra.detectChanges();

    expect(otra.nativeElement.querySelector('.abeja')).toBeNull();
    expect(sessionStorage.getItem('appointmee.chat-abeja-vista')).toBe('1');
    otra.destroy();
    reducirMovimiento = false;
  });
});
