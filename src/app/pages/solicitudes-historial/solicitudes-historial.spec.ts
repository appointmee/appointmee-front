import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { TAMANO_PAGINA } from '../../models/paginacion';
import { SolicitudEmpleadorDetalleDTO } from '../../models/solicitud-empleador';
import { SolicitudesHistorial } from './solicitudes-historial';

const SOLICITUDES = [
  { id: 21, nombreUsuario: 'Ana', apellidoUsuario: 'Pérez', fechaSolicitud: '2026-11-01' },
  { id: 22, nombreUsuario: 'Bruno', apellidoUsuario: 'Gómez', fechaSolicitud: '2026-10-30' },
  { id: 23, nombreUsuario: 'Carla', apellidoUsuario: 'Díaz', fechaSolicitud: '2026-10-28' },
  { id: 24, nombreUsuario: 'Diego', apellidoUsuario: 'Sosa', fechaSolicitud: '2026-10-25' },
  { id: 25, nombreUsuario: 'Elena', apellidoUsuario: 'Ruiz', fechaSolicitud: '2026-10-20' },
];

function pagina(
  content: readonly (typeof SOLICITUDES)[number][] = SOLICITUDES,
  totalElements = SOLICITUDES.length,
  totalPages = 1,
  number = 0,
) {
  return { content, totalElements, totalPages, number, size: TAMANO_PAGINA };
}

function detalle(id: number, estado: SolicitudEmpleadorDetalleDTO['estado']): SolicitudEmpleadorDetalleDTO {
  return {
    id,
    motivo: `Motivo de la solicitud ${id}`,
    estado,
    fechaSolicitud: '2026-11-01',
    usuario: {
      id: 1,
      nombre: 'Ana',
      apellido: 'Pérez',
      email: 'ana@example.com',
      urlFotoPerfil: null,
    },
    ubicaciones: [
      {
        id: 9,
        direccion: '25 de Mayo 2423, B7600GWE Mar del Plata, Provincia de Buenos Aires, Argentina',
        latitud: -34.5889,
        longitud: -58.3951,
        googlePlaceId: 'ChIJ_historial',
      },
    ],
  };
}

describe('Historial completo de solicitudes', () => {
  let fixture: ComponentFixture<SolicitudesHistorial>;
  let backend: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SolicitudesHistorial],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(SolicitudesHistorial);
    fixture.detectChanges();
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    fixture.destroy();
    backend.verify();
  });

  function listar(page = 0): ReturnType<HttpTestingController['expectOne']> {
    const peticion = backend.expectOne((request) =>
      request.url.endsWith('/solicitudes-empleador/propias/paginado'),
    );
    expect(peticion.request.params.get('page')).toBe(String(page));
    return peticion;
  }

  function peticionDetalle(): ReturnType<HttpTestingController['expectOne']> {
    return backend.expectOne((request) => request.url.endsWith('/detalles'));
  }

  function alternar(indice = 0): void {
    const host = fixture.nativeElement as HTMLElement;
    const boton = host.querySelectorAll<HTMLButtonElement>('.solicitud__alternar')[indice];
    boton?.click();
    fixture.detectChanges();
  }

  it('pide la página 0, usa los metadatos del backend y pagina sin perder el total', () => {
    listar(0).flush(pagina(SOLICITUDES, 23, 3, 0));
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelectorAll('app-solicitud-empleador-card')).toHaveLength(5);
    expect(host.querySelector('.panel__contador')?.textContent?.trim()).toBe('23');
    expect(host.textContent).toContain('Página 1 de 3');
    expect(host.textContent).toContain('10 por página');
    expect(host.querySelector('ds-pagination')).not.toBeNull();
    expect(host.textContent).toContain('Estado a consultar');
    expect(backend.match((request) => request.url.endsWith('/detalles'))).toHaveLength(0);
    expect(host.querySelector<HTMLAnchorElement>('.volver')?.getAttribute('href')).toBe(
      '/solicitudes',
    );

    alternar();

    expect(host.querySelector('.solicitud__cargando')).not.toBeNull();

    peticionDetalle().flush(detalle(21, 'RECHAZADA'));
    fixture.detectChanges();

    expect(host.textContent).toContain('Motivo de la solicitud 21');
    expect(host.textContent).toContain('Rechazada');
    const direccionMostrada = host.querySelector('.detalle__ubicacion-direccion')?.textContent?.trim();
    expect(direccionMostrada).toBe('25 de Mayo 2423, Mar del Plata');
    expect(host.textContent).not.toContain('B7600GWE');
    expect(host.textContent).not.toContain('Provincia de Buenos Aires');
    expect(host.querySelector('.solicitud__cargando')).toBeNull();

    const enlace = host.querySelector<HTMLAnchorElement>('.detalle__ubicacion-mapa');
    expect(enlace?.textContent).toContain('Ver en Google Maps');
    expect(new URL(enlace!.href).searchParams.get('query_place_id')).toBe('ChIJ_historial');
    expect(enlace!.target).toBe('_blank');

    alternar();
    alternar();

    expect(backend.match((request) => request.url.endsWith('/detalles'))).toHaveLength(0);
    expect(host.textContent).toContain('Motivo de la solicitud 21');

    host.querySelector<HTMLButtonElement>('ds-pagination .ds-pagination__next')?.click();
    fixture.detectChanges();

    listar(1).flush(pagina([SOLICITUDES[0]], 23, 3, 1));
    fixture.detectChanges();

    expect(host.querySelectorAll('app-solicitud-empleador-card')).toHaveLength(1);
    expect(host.querySelector('.panel__contador')?.textContent?.trim()).toBe('23');
    expect(host.textContent).toContain('Página 2 de 3');
    expect(host.textContent).toContain('Estado a consultar');
  });

  it('recorre más de diez solicitudes en páginas consecutivas sin duplicados', () => {
    const primeraPagina = Array.from({ length: 10 }, (_, indice) => ({
      ...SOLICITUDES[0],
      id: 100 + indice,
      nombreUsuario: `Primera ${100 + indice}`,
    }));
    const segundaPagina = Array.from({ length: 2 }, (_, indice) => ({
      ...SOLICITUDES[0],
      id: 110 + indice,
      nombreUsuario: `Segunda ${110 + indice}`,
    }));

    listar(0).flush(pagina(primeraPagina, 12, 2, 0));
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelectorAll('app-solicitud-empleador-card')).toHaveLength(10);
    expect(host.textContent).toContain('12 solicitudes en total · 10 por página');

    host.querySelector<HTMLButtonElement>('ds-pagination .ds-pagination__next')?.click();
    fixture.detectChanges();

    listar(1).flush(pagina(segundaPagina, 12, 2, 1));
    fixture.detectChanges();

    expect(host.querySelectorAll('app-solicitud-empleador-card')).toHaveLength(2);
    expect(host.textContent).toContain('Página 2 de 2');
    expect(host.textContent).toContain('12 solicitudes en total');
    expect(host.textContent).toContain('Segunda 110');
    expect(host.textContent).toContain('Segunda 111');
    expect(host.textContent).not.toContain('Primera 100');
  });

  it('ante un error de detalle permite reintentar sin perder la solicitud', () => {
    listar(0).flush(pagina([SOLICITUDES[0]], 1, 1, 0));
    fixture.detectChanges();

    alternar();
    peticionDetalle().flush({}, { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('No pudimos cargar el detalle de la solicitud');
    expect(host.textContent).toContain('Ana Pérez');

    const reintentar = host.querySelector<HTMLButtonElement>('.solicitud__error button');
    expect(reintentar?.textContent).toContain('Reintentar detalle');
    reintentar?.click();
    fixture.detectChanges();

    peticionDetalle().flush(detalle(21, 'APROBADA'));
    fixture.detectChanges();

    expect(host.querySelector('.solicitud__error')).toBeNull();
    expect(host.textContent).toContain('Motivo de la solicitud 21');
    expect(host.textContent).toContain('Aprobada');
  });

  it('muestra el vacío con acceso de vuelta y recupera el listado ante un error', () => {
    listar(0).flush({}, { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('No pudimos cargar tus solicitudes');

    host.querySelector<HTMLButtonElement>('.estado--error .boton')?.click();
    fixture.detectChanges();

    listar(0).flush(pagina([], 0, 0, 0));
    fixture.detectChanges();

    expect(host.textContent).toContain('Todavía no enviaste solicitudes');
    expect(host.querySelector('ds-pagination')).toBeNull();
    const volver = host.querySelector<HTMLAnchorElement>('.estado--vacio a.boton');
    expect(volver?.textContent).toContain('Volver a Solicitudes');
    expect(volver?.getAttribute('href')).toBe('/solicitudes');
  });

  it('vuelve a la página 0 al reintentar un error ocurrido en otra página', () => {
    listar(0).flush(pagina(SOLICITUDES, 23, 3, 0));
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    host.querySelector<HTMLButtonElement>('ds-pagination .ds-pagination__next')?.click();
    fixture.detectChanges();

    listar(1).flush({}, { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();

    expect(host.querySelector('.aviso--error')).not.toBeNull();

    host.querySelector<HTMLButtonElement>('.aviso--error button')?.click();
    fixture.detectChanges();

    listar(0).flush(pagina([SOLICITUDES[0]], 23, 3, 0));
    fixture.detectChanges();

    expect(host.textContent).toContain('Página 1 de 3');
    expect(host.querySelector('.aviso--error')).toBeNull();
  });
});
