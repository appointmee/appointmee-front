import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';

import { SolicitudesSucursal } from './solicitudes-sucursal';

describe('SolicitudesSucursal', () => {
  let fixture: ComponentFixture<SolicitudesSucursal>;
  let backend: HttpTestingController;
  let html: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SolicitudesSucursal],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: convertToParamMap({ sucursalId: '7' }) },
          },
        },
      ],
    }).compileComponents();

    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(SolicitudesSucursal);
    fixture.detectChanges();
    html = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => {
    fixture.destroy();
    backend.verify();
  });

  function responderSolicitudes(): void {
    backend
      .expectOne((request) => request.url.endsWith('/solicitudes-empleado/enviadas/sucursal/7'))
      .flush([]);
  }

  it('muestra la foto de la sucursal desenfocada detrás de las solicitudes', () => {
    backend
      .expectOne((request) => request.url.endsWith('/sucursales/7'))
      .flush({ fotoPerfil: 'https://example.com/sucursal.jpg' });
    responderSolicitudes();
    fixture.detectChanges();

    const fondo = html.querySelector<HTMLImageElement>('.pagina__fondo-sucursal');
    expect(fondo?.getAttribute('src')).toBe('https://example.com/sucursal.jpg');
    expect(fondo?.getAttribute('aria-hidden')).toBe('true');
    expect(html.querySelector('.solicitudes__layout')).toBeTruthy();

    fondo?.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(html.querySelector('.pagina__fondo-sucursal')).toBeNull();
    expect(html.querySelector('.solicitudes__layout')).toBeTruthy();
  });

  it('mantiene la pantalla funcional si falla la carga de la foto', () => {
    backend
      .expectOne((request) => request.url.endsWith('/sucursales/7'))
      .flush('Error', { status: 503, statusText: 'Service Unavailable' });
    responderSolicitudes();
    fixture.detectChanges();

    expect(html.querySelector('.pagina__fondo-sucursal')).toBeNull();
    expect(html.querySelector('.solicitudes__layout')).toBeTruthy();
    expect(html.textContent).toContain('Solicitudes de empleo');
  });
});
