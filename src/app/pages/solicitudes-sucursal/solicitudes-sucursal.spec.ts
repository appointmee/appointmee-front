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
      .flush({ content: [], totalElements: 0, hayMas: false });
  }

  function responderDetalles(ids: readonly number[]): void {
    for (const id of ids) {
      backend
        .expectOne((request) => request.url.endsWith(`/solicitudes-empleado/${id}/detalles`))
        .flush({
          id,
          estadoSolicitud: 'PENDIENTE',
          fechaSolicitud: '2026-11-20',
          empleado: {
            id,
            nombre: 'Invitado',
            apellido: 'Apellido',
            email: `invitado-${id}@example.com`,
            urlFotoPerfil: null,
          },
          sucursal: {
            id: 7,
            nombre: 'Sucursal',
            categoria: 'SPA',
            fotoPerfil: null,
            puntuacion: null,
            cantidadPuntuaciones: 0,
          },
        });
    }
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
    const css = Array.from(document.querySelectorAll('style'))
      .map((style) => style.textContent ?? '')
      .join('\n');
    expect(css).toMatch(
      /\.panel[^{]*\{[^}]*background:\s*color-mix\(in srgb, var\(--surface\) 64%, transparent\)/,
    );
    expect(css).toMatch(/\.panel[^{]*\{[^}]*backdrop-filter:\s*blur\(12px\)/);

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

  it('muestra las tres del backend y enlaza al historial solo si hay más', () => {
    backend.expectOne((request) => request.url.endsWith('/sucursales/7')).flush({
      fotoPerfil: null,
    });
    backend
      .expectOne((request) => request.url.endsWith('/solicitudes-empleado/enviadas/sucursal/7'))
      .flush({
        content: Array.from({ length: 3 }, (_, indice) => ({
          id: 100 + indice,
          nombreEmpleado: `Invitado ${indice}`,
          apellidoEmpleado: 'Apellido',
          fechaSolicitud: '2026-11-20',
        })),
        totalElements: 8,
        hayMas: true,
      });
    fixture.detectChanges();
    responderDetalles([100, 101, 102]);
    fixture.detectChanges();

    expect(html.querySelectorAll('app-solicitud-empleado-card')).toHaveLength(3);
    expect(html.textContent).toContain('Invitado 0');
    expect(html.querySelector('.ver-mas')).not.toBeNull();
  });

  it('oculta el enlace cuando el backend informa que no hay más', () => {
    backend.expectOne((request) => request.url.endsWith('/sucursales/7')).flush({
      fotoPerfil: null,
    });
    backend
      .expectOne((request) => request.url.endsWith('/solicitudes-empleado/enviadas/sucursal/7'))
      .flush({
        content: [
          {
            id: 200,
            nombreEmpleado: 'Único',
            apellidoEmpleado: 'Invitado',
            fechaSolicitud: '2026-11-20',
          },
        ],
        totalElements: 1,
        hayMas: false,
      });
    fixture.detectChanges();
    responderDetalles([200]);
    fixture.detectChanges();

    expect(html.querySelectorAll('app-solicitud-empleado-card')).toHaveLength(1);
    expect(html.querySelector('.ver-mas')).toBeNull();
  });

  it('no confunde un formato anterior del backend con una falla de conexión', () => {
    backend.expectOne((request) => request.url.endsWith('/sucursales/7')).flush({
      fotoPerfil: null,
    });
    backend
      .expectOne((request) => request.url.endsWith('/solicitudes-empleado/enviadas/sucursal/7'))
      .flush([
        {
          id: 300,
          nombreEmpleado: 'Formato anterior',
          apellidoEmpleado: 'Invitado',
          fechaSolicitud: '2026-11-20',
        },
      ]);
    fixture.detectChanges();

    expect(html.querySelector('.estado--error')).not.toBeNull();
    expect(html.textContent).not.toContain('No pudimos conectarnos');
    expect(html.textContent).toContain('No pudimos cargar tus solicitudes de empleo');
  });

  it('sí informa falla de conexión cuando la petición realmente falla', () => {
    backend.expectOne((request) => request.url.endsWith('/sucursales/7')).flush({
      fotoPerfil: null,
    });
    backend
      .expectOne((request) => request.url.endsWith('/solicitudes-empleado/enviadas/sucursal/7'))
      .error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });
    fixture.detectChanges();

    expect(html.textContent).toContain('No pudimos conectarnos');
  });
});
