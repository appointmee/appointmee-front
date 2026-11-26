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

const sinLeer = {
  id: 1,
  tipo: 'RESERVA' as const,
  titulo: 'Nuevo turno',
  mensaje: 'Tenés un turno nuevo.',
  fecha: '2026-11-26T09:00:00',
  leida: false,
};

describe('Centro de notificaciones (US-NOT-03)', () => {
  let roles: readonly string[];
  let listar: ReturnType<
    typeof vi.fn<(
      pagina: number,
      tamano: number,
      tipo?: string,
      lectura?: string,
    ) => Observable<PaginaNotificacionesDTO>>
  >;
  let contar: ReturnType<typeof vi.fn<() => Observable<{ noLeidas: number }>>>;
  let marcarUna: ReturnType<typeof vi.fn<(id: number) => Observable<{ noLeidas: number }>>>;
  let marcarTodas: ReturnType<typeof vi.fn<(tipo?: string) => Observable<{ noLeidas: number }>>>;
  let router: Router;
  let chatWidget: chatWidgetService;

  const servicio = {
    listar: (...args: Parameters<typeof listar>) => listar(...args),
    contarNoLeidas: () => contar(),
    marcarLeida: (id: number) => marcarUna(id),
    marcarTodasLeidas: (...args: Parameters<typeof marcarTodas>) => marcarTodas(...args),
  };

  beforeEach(() => {
    roles = ['CLIENTE'];
    listar = vi.fn(() => of(pagina([])));
    contar = vi.fn(() => of({ noLeidas: 2 }));
    marcarUna = vi.fn(() => of({ noLeidas: 0 }));
    marcarTodas = vi.fn(() => of({ noLeidas: 0 }));

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

  it('pide sólo las últimas 20 notificaciones y ofrece ver todas', async () => {
    const { fixture } = await renderizar();
    abrirPanel(fixture);

    expect(listar).toHaveBeenCalledWith(0, 20);
    const enlace = fixture.nativeElement.querySelector('.panel__ver-todas') as HTMLAnchorElement;
    expect(enlace).not.toBeNull();
    expect(enlace.getAttribute('href')).toBe('/notificaciones');
    expect(enlace.textContent).toContain('Ver todas');
  });

  it('abre el panel con estados de carga y muestra fecha y estado de cada notificación', async () => {
    const respuesta = new Subject<PaginaNotificacionesDTO>();
    listar.mockReturnValue(respuesta.asObservable());
    const { fixture, boton } = await renderizar();

    abrirPanel(fixture);

    expect(boton.getAttribute('aria-expanded')).toBe('true');
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('[aria-busy="true"] .sr-only')?.textContent,
    ).toContain('Cargando');

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

  it('navega al destino de turnos al abrir una notificación sin cambiar su estado', async () => {
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
    expect(marcarUna).not.toHaveBeenCalled();

    abrirPanel(fixture);
    const reabierta = fixture.nativeElement.querySelector('.notificacion') as HTMLButtonElement;
    expect(reabierta.textContent).toContain('Sin leer');
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

  it('abre la entidad concreta cuando el backend informa destino', async () => {
    const casos = [
      {
        tipo: 'RESERVA', destinoTipo: 'TURNO', destinoId: 41, sucursalId: 7,
        ruta: '/mis-turnos?turnoId=41&sucursalId=7',
      },
      {
        tipo: 'PAGO', destinoTipo: 'PAGO', destinoId: 42, sucursalId: 7,
        ruta: '/pago/resultado?turnoId=42&sucursalId=7',
      },
      {
        tipo: 'SOLICITUD', destinoTipo: 'SOLICITUD', destinoId: 43, sucursalId: null,
        ruta: '/solicitudes?solicitudId=43',
      },
    ] as const;

    for (const caso of casos) {
      TestBed.resetTestingModule();
      roles = ['CLIENTE'];
      listar = vi.fn(() => of(pagina([{
        id: caso.destinoId,
        tipo: caso.tipo,
        titulo: 'Aviso concreto',
        mensaje: 'Revisá el detalle.',
        fecha: '2026-11-26T09:00:00',
        leida: true,
        destinoTipo: caso.destinoTipo,
        destinoId: caso.destinoId,
        sucursalId: caso.sucursalId,
      }], 0)));
      TestBed.configureTestingModule({
        imports: [NotificacionesCentro],
        providers: [
          provideRouter([
            { path: '', component: DestinoPrueba },
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
      expect(routerLocal.url).toBe(caso.ruta);
    }

    TestBed.resetTestingModule();
    listar = vi.fn(() => of(pagina([{
      id: 5,
      tipo: 'MENSAJE',
      titulo: 'Mensaje nuevo',
      mensaje: 'Tenés un mensaje nuevo.',
      fecha: '2026-11-26T09:00:00',
      leida: true,
      destinoTipo: 'CONVERSACION',
      destinoId: 99,
      sucursalId: null,
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
    const widget = TestBed.inject(chatWidgetService);
    expect(widget.abierto()).toBe(true);
    expect(widget.conversacionId()).toBe(99);
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

  it('demo 1: marca una notificación como leída con una acción y actualiza el contador', async () => {
    listar
      .mockReturnValueOnce(of(pagina([sinLeer], 1)))
      .mockReturnValue(of(pagina([{ ...sinLeer, leida: true }], 0)));
    marcarUna.mockReturnValue(of({ noLeidas: 0 }));
    const { fixture, boton } = await renderizar();
    abrirPanel(fixture);

    const botonMarcar = fixture.nativeElement.querySelector('.panel__marcar') as HTMLButtonElement;
    expect(botonMarcar).not.toBeNull();
    botonMarcar.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(marcarUna).toHaveBeenCalledWith(1);
    expect(boton.getAttribute('aria-label')).toContain('no hay notificaciones sin leer');
    expect(fixture.nativeElement.querySelector('.notificacion')?.textContent).toContain('Leída');
    expect(fixture.nativeElement.querySelector('.panel__marcar')).toBeNull();
  });

  it('demo 2: marca todas como leídas con una sola acción', async () => {
    listar
      .mockReturnValueOnce(of(pagina([sinLeer, { ...sinLeer, id: 2 }], 2)))
      .mockReturnValue(of(pagina([
        { ...sinLeer, leida: true },
        { ...sinLeer, id: 2, leida: true },
      ], 0)));
    marcarTodas.mockReturnValue(of({ noLeidas: 0 }));
    const { fixture, boton } = await renderizar();
    abrirPanel(fixture);

    const botonTodas = fixture.nativeElement.querySelector('.panel__marcar-todas') as HTMLButtonElement;
    botonTodas.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(marcarTodas).toHaveBeenCalledWith();
    expect(boton.getAttribute('aria-label')).toContain('no hay notificaciones sin leer');
    expect(fixture.nativeElement.querySelector('.panel__marcar')).toBeNull();
  });

  it('no muestra los filtros en el panel: viven sólo en /notificaciones', async () => {
    const { fixture } = await renderizar();
    abrirPanel(fixture);

    expect(fixture.nativeElement.querySelector('.panel__filtros')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Tipo de notificación');
    expect(fixture.nativeElement.textContent).not.toContain('Estado de lectura');
  });

  it('muestra el error inline al marcar como leída y permite reintentar', async () => {
    listar.mockReturnValue(of(pagina([sinLeer], 1)));
    marcarUna
      .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500 })))
      .mockReturnValue(of({ noLeidas: 0 }));
    const { fixture } = await renderizar();
    abrirPanel(fixture);

    (fixture.nativeElement.querySelector('.panel__marcar') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();

    const alerta = fixture.nativeElement.querySelector('.panel__accion-error') as HTMLElement;
    expect(alerta).not.toBeNull();
    expect(alerta.textContent).toContain('No pudimos marcar la notificación como leída');
    (alerta.querySelector('.panel__accion') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(marcarUna).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.querySelector('.panel__accion-error')).toBeNull();
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
