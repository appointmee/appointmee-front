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

describe('Página de notificaciones (US-NOT-03)', () => {
  let listar: ReturnType<
    typeof vi.fn<(pagina: number, tamano: number) => Observable<PaginaNotificacionesDTO>>
  >;
  let fixture: ComponentFixture<Notificaciones>;
  let router: Router;

  const servicio = {
    listar: (pagina: number, tamano: number) => listar(pagina, tamano),
  };

  beforeEach(async () => {
    TestBed.resetTestingModule();
    listar = vi.fn(() => of(pagina([])));

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

  it('carga la primera página de 20 y muestra fecha y estado', () => {
    expect(listar).toHaveBeenCalledWith(0, 20);
    expect(html().textContent).toContain('No tenés notificaciones');
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
    expect(lista.textContent).toContain('Sin leer');
    expect(html().querySelector('ds-pagination')).not.toBeNull();

    const siguiente = Array.from(html().querySelectorAll('button')).find(
      (boton) => boton.textContent?.trim() === 'Siguiente',
    ) as HTMLButtonElement;
    siguiente.click();
    fixture.detectChanges();

    expect(listar).toHaveBeenCalledWith(1, 20);
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
