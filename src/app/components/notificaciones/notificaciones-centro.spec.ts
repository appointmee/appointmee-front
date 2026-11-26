import { HttpErrorResponse } from '@angular/common/http';
import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';

import type { PaginaNotificacionesDTO } from '../../models/notificacion';
import { authService } from '../../services/auth-service';
import { chatWidgetService } from '../../services/chat-widget-service';
import { notificacionService } from '../../services/notificacion-service';
import { NotificacionesCentro } from './notificaciones-centro';

@Component({ selector: 'app-destino-prueba', template: '' })
class DestinoPrueba {}

const pagina = (
  contenido: PaginaNotificacionesDTO['contenido'],
  noLeidas = contenido.filter((notificacion) => !notificacion.leida).length,
): PaginaNotificacionesDTO => ({
  contenido,
  pagina: 0,
  tamano: 20,
  totalElementos: contenido.length,
  totalPaginas: 1,
  noLeidas,
});

describe('Centro de notificaciones (US-NOT-03)', () => {
  let roles: readonly string[];
  let listar: ReturnType<typeof vi.fn<() => Observable<PaginaNotificacionesDTO>>>;
  let contar: ReturnType<typeof vi.fn<() => Observable<{ noLeidas: number }>>>;
  let router: Router;
  let chatWidget: chatWidgetService;

  const servicio = {
    listar: () => listar(),
    contarNoLeidas: () => contar(),
  };

  beforeEach(() => {
    roles = ['CLIENTE'];
    listar = vi.fn(() => of(pagina([])));
    contar = vi.fn(() => of({ noLeidas: 2 }));

    TestBed.configureTestingModule({
      imports: [NotificacionesCentro],
      providers: [
        provideRouter([
          { path: '', component: DestinoPrueba },
          { path: 'mis-turnos', component: DestinoPrueba },
          { path: 'turnos-asignados', component: DestinoPrueba },
          { path: 'admin', component: DestinoPrueba },
          { path: 'pago/resultado', component: DestinoPrueba },
          { path: 'solicitudes', component: DestinoPrueba },
          { path: 'configuracion', component: DestinoPrueba },
        ]),
        { provide: notificacionService, useValue: servicio },
        {
          provide: authService,
          useValue: {
            autenticado: () => true,
            visitante: () => false,
            restaurando: () => false,
            perfil: signal(null),
            tieneAlgunRol: (...solicitados: string[]) =>
              solicitados.some((rol) => roles.includes(rol)),
          },
        },
      ],
    });

    router = TestBed.inject(Router);
    chatWidget = TestBed.inject(chatWidgetService);
  });

  async function renderizar(): Promise<{ fixture: ComponentFixture<NotificacionesCentro>; boton: HTMLButtonElement }> {
    const fixture = TestBed.createComponent(NotificacionesCentro);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return {
      fixture,
      boton: fixture.nativeElement.querySelector('.notificaciones__campana') as HTMLButtonElement,
    };
  }

  function abrirPanel(fixture: ComponentFixture<NotificacionesCentro>): void {
    (fixture.nativeElement.querySelector('.notificaciones__campana') as HTMLButtonElement).click();
    fixture.detectChanges();
  }

  it('muestra el contador de no leídas en la campana con nombre accesible', async () => {
    const { boton } = await renderizar();

    expect(boton.getAttribute('aria-label')).toBe('Notificaciones, 2 sin leer');
    expect(boton.querySelector('.notificaciones__contador')?.textContent).toContain('2');
    expect(contar).toHaveBeenCalledOnce();
  });

  it('abre el panel con estados de carga y muestra fecha y estado de cada notificación', async () => {
    const respuesta = new Subject<PaginaNotificacionesDTO>();
    listar.mockReturnValue(respuesta.asObservable());
    const { fixture, boton } = await renderizar();

    abrirPanel(fixture);

    expect(boton.getAttribute('aria-expanded')).toBe('true');
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.sr-only')?.textContent).toContain('Cargando');

    respuesta.next(pagina([{
      id: 7,
      tipo: 'RESERVA',
      titulo: 'Turno confirmado',
      mensaje: 'Tu turno quedó confirmado.',
      fecha: '2026-11-26T10:30:00',
      leida: false,
    }], 3));
    fixture.detectChanges();

    const item = fixture.nativeElement.querySelector('.notificacion') as HTMLButtonElement;
    expect(item).not.toBeNull();
    expect(item.textContent).toContain('Turno confirmado');
    expect(item.textContent).toContain('Tu turno quedó confirmado.');
    expect(item.querySelector('time')?.textContent).toContain('2026');
    expect(item.textContent).toContain('Sin leer');
    expect(item.getAttribute('aria-label')).toContain('sin leer');
    expect(boton.querySelector('.notificaciones__contador')?.textContent).toContain('3');
  });

  it('es accesible por teclado: foco al abrir, Escape cierra y devuelve el foco', async () => {
    const { fixture, boton } = await renderizar();
    abrirPanel(fixture);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(boton.getAttribute('aria-haspopup')).toBe('dialog');
    expect(boton.getAttribute('aria-controls')).toBe('notificaciones-panel');
    expect(document.activeElement).toBe(fixture.nativeElement.querySelector('.panel__cerrar'));

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(boton);
  });

  it('marca como leída y navega al destino de turnos al abrir una notificación', async () => {
    listar.mockReturnValue(of(pagina([{
      id: 1,
      tipo: 'RESERVA',
      titulo: 'Nuevo turno',
      mensaje: 'Tenés un turno nuevo.',
      fecha: '2026-11-26T09:00:00',
      leida: false,
    }], 1)));
    const { fixture, boton } = await renderizar();
    abrirPanel(fixture);
    await router.navigateByUrl('/');

    (fixture.nativeElement.querySelector('.notificacion') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(router.url).toBe('/mis-turnos');
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
    expect(boton.getAttribute('aria-label')).toContain('no hay notificaciones sin leer');

    abrirPanel(fixture);
    const reabierta = fixture.nativeElement.querySelector('.notificacion') as HTMLButtonElement;
    expect(reabierta.textContent).toContain('Leída');
    expect(reabierta.getAttribute('aria-label')).toContain('leída');
  });

  it('lleva a pagos, solicitudes y al widget de chat según el tipo', async () => {
    for (const [tipo, ruta] of [
      ['PAGO', '/pago/resultado'],
      ['SOLICITUD', '/solicitudes'],
    ] as const) {
      TestBed.resetTestingModule();
      roles = ['CLIENTE'];
      listar = vi.fn(() => of(pagina([{
        id: 2,
        tipo,
        titulo: 'Aviso',
        mensaje: 'Revisá tu cuenta.',
        fecha: '2026-11-26T09:00:00',
        leida: true,
      }], 0)));
      contar = vi.fn(() => of({ noLeidas: 0 }));
      TestBed.configureTestingModule({
        imports: [NotificacionesCentro],
        providers: [
          provideRouter([
            { path: 'mis-turnos', component: DestinoPrueba },
            { path: 'pago/resultado', component: DestinoPrueba },
            { path: 'solicitudes', component: DestinoPrueba },
          ]),
          { provide: notificacionService, useValue: servicio },
          {
            provide: authService,
            useValue: {
              autenticado: () => true,
              visitante: () => false,
              restaurando: () => false,
              tieneAlgunRol: (...solicitados: string[]) =>
                solicitados.some((rol) => roles.includes(rol)),
            },
          },
        ],
      });
      const routerLocal = TestBed.inject(Router);
      await routerLocal.navigateByUrl('/');
      const fixture = TestBed.createComponent(NotificacionesCentro);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      abrirPanel(fixture);
      (fixture.nativeElement.querySelector('.notificacion') as HTMLButtonElement).click();
      await fixture.whenStable();
      expect(routerLocal.url).toBe(ruta);
      expect(TestBed.inject(chatWidgetService).abierto()).toBe(false);
    }

    TestBed.resetTestingModule();
    listar = vi.fn(() => of(pagina([{
      id: 3,
      tipo: 'MENSAJE',
      titulo: 'Mensaje nuevo',
      mensaje: 'Tenés un mensaje nuevo.',
      fecha: '2026-11-26T09:00:00',
      leida: true,
    }], 0)));
    TestBed.configureTestingModule({
      imports: [NotificacionesCentro],
      providers: [
        provideRouter([{ path: '', component: DestinoPrueba }]),
        { provide: notificacionService, useValue: servicio },
        {
          provide: authService,
          useValue: {
            autenticado: () => true,
            visitante: () => false,
            restaurando: () => false,
            tieneAlgunRol: () => false,
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(NotificacionesCentro);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    abrirPanel(fixture);
    (fixture.nativeElement.querySelector('.notificacion') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(TestBed.inject(chatWidgetService).abierto()).toBe(true);
  });

  it('usa el destino de turnos según el rol', async () => {
    roles = ['ADMINISTRADOR'];
    listar.mockReturnValue(of(pagina([{
      id: 4,
      tipo: 'RECORDATORIO',
      titulo: 'Recordatorio',
      mensaje: 'Revisá el turno.',
      fecha: null,
      leida: true,
    }], 0)));
    const { fixture } = await renderizar();
    await router.navigateByUrl('/');
    abrirPanel(fixture);
    (fixture.nativeElement.querySelector('.notificacion') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(router.url).toBe('/admin');
  });

  it('muestra estado vacío con acción para actualizar', async () => {
    const { fixture } = await renderizar();
    abrirPanel(fixture);

    expect(fixture.nativeElement.querySelector('[role="status"]')?.textContent).toContain(
      'No tenés notificaciones',
    );
    expect(fixture.nativeElement.querySelector('.panel__accion')?.textContent).toContain(
      'Actualizar',
    );
  });

  it('muestra error inline, bloquea el doble clic y permite reintentar', async () => {
    const reintento = new Subject<PaginaNotificacionesDTO>();
    listar
      .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500 })))
      .mockReturnValue(reintento.asObservable());
    const { fixture } = await renderizar();
    abrirPanel(fixture);

    const alerta = fixture.nativeElement.querySelector('[role="alert"]') as HTMLElement;
    expect(alerta).not.toBeNull();
    expect(alerta.textContent).toContain('No pudimos cargar tus notificaciones');

    const botonReintentar = alerta.querySelector('.panel__accion') as HTMLButtonElement;
    botonReintentar.click();
    botonReintentar.click();
    fixture.detectChanges();

    expect(listar).toHaveBeenCalledTimes(2);
    expect((fixture.nativeElement.querySelector('.panel__accion') as HTMLButtonElement).disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('.panel__accion')?.getAttribute('aria-busy')).toBe('true');

    reintento.next(pagina([]));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[role="status"]')?.textContent).toContain(
      'No tenés notificaciones',
    );
  });

  it('avisa cuando el navegador está sin conexión', async () => {
    const original = navigator.onLine;
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    try {
      const { fixture } = await renderizar();
      abrirPanel(fixture);
      expect(fixture.nativeElement.querySelector('.panel__aviso')?.textContent).toContain(
        'Sin conexión',
      );
    } finally {
      Object.defineProperty(navigator, 'onLine', { configurable: true, value: original });
    }
  });
});
