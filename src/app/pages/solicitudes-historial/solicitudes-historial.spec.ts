import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SolicitudEmpleadorDetalleDTO } from '../../models/solicitud-empleador';
import { SolicitudesHistorial } from './solicitudes-historial';

const SOLICITUDES = [
  { id: 21, nombreUsuario: 'Ana', apellidoUsuario: 'Pérez', fechaSolicitud: '2026-11-01' },
  { id: 22, nombreUsuario: 'Bruno', apellidoUsuario: 'Gómez', fechaSolicitud: '2026-10-30' },
  { id: 23, nombreUsuario: 'Carla', apellidoUsuario: 'Díaz', fechaSolicitud: '2026-10-28' },
  { id: 24, nombreUsuario: 'Diego', apellidoUsuario: 'Sosa', fechaSolicitud: '2026-10-25' },
  { id: 25, nombreUsuario: 'Elena', apellidoUsuario: 'Ruiz', fechaSolicitud: '2026-10-20' },
];

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

  function listar(): ReturnType<HttpTestingController['expectOne']> {
    return backend.expectOne((request) =>
      request.url.endsWith('/solicitudes-empleador/propias'),
    );
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

  it('lista todas las solicitudes y carga el detalle solo al expandir', () => {
    listar().flush(SOLICITUDES);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelectorAll('app-solicitud-empleador-card')).toHaveLength(5);
    expect(host.querySelector('.panel__contador')?.textContent?.trim()).toBe('5');
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
    expect(host.querySelector('.solicitud__cargando')).toBeNull();

    alternar();
    alternar();

    expect(backend.match((request) => request.url.endsWith('/detalles'))).toHaveLength(0);
    expect(host.textContent).toContain('Motivo de la solicitud 21');
  });

  it('ante un error de detalle permite reintentar sin perder la solicitud', () => {
    listar().flush([SOLICITUDES[0]]);
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
    listar().flush({}, { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('No pudimos cargar tus solicitudes');

    host.querySelector<HTMLButtonElement>('.estado--error .boton')?.click();
    fixture.detectChanges();

    listar().flush([]);
    fixture.detectChanges();

    expect(host.textContent).toContain('Todavía no enviaste solicitudes');
    const volver = host.querySelector<HTMLAnchorElement>('.estado--vacio a.boton');
    expect(volver?.textContent).toContain('Volver a Solicitudes');
    expect(volver?.getAttribute('href')).toBe('/solicitudes');
  });
});
