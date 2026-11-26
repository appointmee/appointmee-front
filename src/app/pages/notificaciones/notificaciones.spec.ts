import { HttpErrorResponse } from '@angular/common/http';
import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';

import type { PaginaNotificacionesDTO } from '../../models/notificacion';
import { authService } from '../../services/auth-service';
import { chatWidgetService } from '../../services/chat-widget-service';
import { notificacionService } from '../../services/notificacion-service';
import { Notificaciones } from './notificaciones';

@Component({ selector: 'app-destino-prueba', template: '' })
class DestinoPrueba {}

const pagina = (
  contenido: PaginaNotificacionesDTO['contenido'],
  totalPaginas = 1,
  noLeidas = contenido.filter((item) => !item.leida).length,
): PaginaNotificacionesDTO => ({
  contenido,
  pagina: 0,
  tamano: 20,
  totalElementos: contenido.length,
  totalPaginas,
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

describe('Página de notificaciones (US-NOT-03)', () => {
  let listar: ReturnType<
    typeof vi.fn<(
      pagina: number,
      tamano: number,
      tipo?: string,
      lectura?: string,
    ) => Observable<PaginaNotificacionesDTO>>
  >;
  let marcarUna: ReturnType<typeof vi.fn<(id: number) => Observable<{ noLeidas: number }>>>;
  let marcarTodas: ReturnType<typeof vi.fn<(tipo?: string) => Observable<{ noLeidas: number }>>>;
  let fixture: ComponentFixture<Notificaciones>;
  let router: Router;

  const servicio = {
    listar: (...args: Parameters<typeof listar>) => listar(...args),
    marcarLeida: (id: number) => marcarUna(id),
    marcarTodasLeidas: (...args: Parameters<typeof marcarTodas>) => marcarTodas(...args),
  };

  beforeEach(async () => {
    TestBed.resetTestingModule();
    listar = vi.fn(() => of(pagina([])));
    marcarUna = vi.fn(() => of({ noLeidas: 0 }));
    marcarTodas = vi.fn(() => of({ noLeidas: 0 }));

    await TestBed.configureTestingModule({
      imports: [Notificaciones],
      providers: [
        provideRouter([
          { path: '', component: DestinoPrueba },
          { path: 'notificaciones', component: DestinoPrueba },
          { path: 'mis-turnos', component: DestinoPrueba },
          { path: 'pago/resultado', component: DestinoPrueba },
        ]),
        { provide: notificacionService, useValue: servicio },
        {
          provide: authService,
          useValue: {
            tieneAlgunRol: () => false,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Notificaciones);
    router = TestBed.inject(Router);
    await router.navigateByUrl('/notificaciones');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  afterEach(() => fixture.destroy());

  function html(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it('carga la primera página de 20 y muestra la paginación aunque haya una sola página', () => {
    expect(listar).toHaveBeenCalledWith(0, 20, 'TODOS', 'TODAS');
    expect(html().textContent).toContain('No tenés notificaciones');
    expect(html().querySelector('ds-pagination')?.textContent).toContain('Página 1 de 1');
  });

  it('lista notificaciones y permite paginar', () => {
    listar.mockReturnValue(of(pagina([{
      id: 1,
      tipo: 'RESERVA',
      titulo: 'Turno confirmado',
      mensaje: 'Tu turno quedó confirmado.',
      fecha: '2026-11-26T10:30:00',
      leida: false,
      destinoTipo: 'TURNO',
      destinoId: 101,
      sucursalId: 26,
    }], 2, 1)));

    fixture = TestBed.createComponent(Notificaciones);
    fixture.detectChanges();
    const lista = html().querySelector('.notificacion') as HTMLButtonElement;
    expect(lista).not.toBeNull();
    expect(lista.textContent).toContain('Turno confirmado');
    expect(lista.classList.contains('notificacion--no-leida')).toBe(true);
    expect(lista.querySelector('ds-badge')).toBeNull();
    expect(lista.querySelector('.notificacion__meta span')).toBeNull();
    expect(html().querySelector('ds-pagination')).not.toBeNull();

    const siguiente = Array.from(html().querySelectorAll('button')).find(
      (boton) => boton.textContent?.trim() === 'Siguiente',
    ) as HTMLButtonElement;
    siguiente.click();
    fixture.detectChanges();

    expect(listar).toHaveBeenCalledWith(1, 20, 'TODOS', 'TODAS');
  });

  it('marca como leída y navega al destino concreto', async () => {
    listar.mockReturnValue(of(pagina([{
      id: 2,
      tipo: 'PAGO',
      titulo: 'Pago aprobado',
      mensaje: 'Tu pago fue aprobado.',
      fecha: '2026-11-26T11:00:00',
      leida: false,
      destinoTipo: 'PAGO',
      destinoId: 55,
      sucursalId: 7,
    }])));

    fixture = TestBed.createComponent(Notificaciones);
    fixture.detectChanges();
    (html().querySelector('.notificacion') as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(router.url).toContain('/pago/resultado?turnoId=55&sucursalId=7');
    expect(TestBed.inject(chatWidgetService).abierto()).toBe(false);
  });

  it('demo 1: marca una notificación como leída y actualiza el contador', async () => {
    listar
      .mockReturnValueOnce(of(pagina([sinLeer], 1, 1)))
      .mockReturnValue(of(pagina([{ ...sinLeer, leida: true }], 1, 0)));
    marcarUna.mockReturnValue(of({ noLeidas: 0 }));

    fixture = TestBed.createComponent(Notificaciones);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const marcar = html().querySelector('.notificaciones__marcar') as HTMLButtonElement;
    expect(marcar.querySelector('svg path')?.getAttribute('d')).toBe('M20 6 9 17l-5-5');
    expect(marcar.textContent?.trim()).toBe('');
    marcar.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(marcarUna).toHaveBeenCalledWith(1);
    expect(html().textContent).toContain('0 sin leer');
    expect(html().querySelector('.notificaciones__marcar')).toBeNull();
  });

  it('demo 2: marca todas como leídas con una sola acción', async () => {
    listar
      .mockReturnValueOnce(of(pagina([sinLeer, { ...sinLeer, id: 2 }], 1, 2)))
      .mockReturnValue(of(pagina([
        { ...sinLeer, leida: true },
        { ...sinLeer, id: 2, leida: true },
      ], 1, 0)));
    marcarTodas.mockReturnValue(of({ noLeidas: 0 }));

    fixture = TestBed.createComponent(Notificaciones);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    (html().querySelector('.notificaciones__acciones button') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(marcarTodas).toHaveBeenCalledWith('TODOS');
    expect(html().textContent).toContain('0 sin leer');
    expect(html().querySelector('.notificaciones__marcar')).toBeNull();
  });

  it('demo 3: combina el filtro de tipo con el de estado', () => {
    fixture = TestBed.createComponent(Notificaciones);
    fixture.detectChanges();

    const selects = html().querySelectorAll('.notificaciones__filtros select');
    (selects[0] as HTMLSelectElement).value = 'PAGO';
    selects[0].dispatchEvent(new Event('change'));
    fixture.detectChanges();
    (selects[1] as HTMLSelectElement).value = 'LEIDAS';
    selects[1].dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(listar).toHaveBeenCalledWith(0, 20, 'PAGO', 'LEIDAS');
    expect(html().querySelector('.notificaciones__limpiar')).not.toBeNull();
  });

  it('muestra el error inline al marcar todas y permite reintentar', async () => {
    listar.mockReturnValue(of(pagina([sinLeer], 1, 1)));
    marcarTodas
      .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500 })))
      .mockReturnValue(of({ noLeidas: 0 }));

    fixture = TestBed.createComponent(Notificaciones);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    (html().querySelector('.notificaciones__acciones button') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();

    const alerta = html().querySelector('.notificaciones__accion-error') as HTMLElement;
    expect(alerta).not.toBeNull();
    expect(alerta.textContent).toContain('No pudimos marcar todas las notificaciones');
    (alerta.querySelector('button') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(marcarTodas).toHaveBeenCalledTimes(2);
    expect(html().querySelector('.notificaciones__accion-error')).toBeNull();
  });

  it('muestra error inline con reintento y bloquea el doble clic', () => {
    const reintento = new Subject<PaginaNotificacionesDTO>();
    listar
      .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500 })))
      .mockReturnValue(reintento.asObservable());

    fixture = TestBed.createComponent(Notificaciones);
    fixture.detectChanges();

    const alerta = html().querySelector('[role="alert"]') as HTMLElement;
    expect(alerta?.textContent).toContain('No pudimos cargar tus notificaciones');

    const boton = alerta.querySelector('button') as HTMLButtonElement;
    boton.click();
    boton.click();
    fixture.detectChanges();

    expect(listar).toHaveBeenCalledTimes(3);
    expect(html().querySelector('[aria-busy="true"]')).not.toBeNull();

    reintento.next(pagina([]));
    fixture.detectChanges();
    expect(html().querySelector('[role="alert"]')).toBeNull();
    expect(html().textContent).toContain('No tenés notificaciones');
  });
});
