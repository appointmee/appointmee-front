import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SolicitudEmpleadoDetalleDTO } from '../../models/solicitud-empleado';
import { SolicitudesEmpleadoHistorial } from './solicitudes-empleado-historial';

const RECIBIDAS = [
  { id: 41, nombreSucursal: 'Barbería Central', fechaSolicitud: '2026-11-02' },
  { id: 42, nombreSucursal: 'Estudio Norte', fechaSolicitud: '2026-10-31' },
  { id: 43, nombreSucursal: 'Spa del Río', fechaSolicitud: '2026-10-29' },
  { id: 44, nombreSucursal: 'Peluquería Sur', fechaSolicitud: '2026-10-27' },
  { id: 45, nombreSucursal: 'Gimnasio Oeste', fechaSolicitud: '2026-10-25' },
];

function detalle(
  id: number,
  estado: SolicitudEmpleadoDetalleDTO['estadoSolicitud'],
): SolicitudEmpleadoDetalleDTO {
  return {
    id,
    estadoSolicitud: estado,
    fechaSolicitud: '2026-11-02',
    empleado: {
      id: 99,
      nombre: 'Ana',
      apellido: 'Pérez',
      email: 'ana@example.com',
      urlFotoPerfil: null,
    },
    sucursal: {
      id: 5,
      nombre: 'Barbería Central',
      categoria: 'BARBERIA',
      fotoPerfil: null,
      puntuacion: 4.5,
      cantidadPuntuaciones: 10,
      diasApertura: ['LUNES'],
    },
  };
}

describe('Historial completo de solicitudes de empleo', () => {
  let fixture: ComponentFixture<SolicitudesEmpleadoHistorial>;
  let backend: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SolicitudesEmpleadoHistorial],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(SolicitudesEmpleadoHistorial);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    backend.verify();
  });

  function listar(): ReturnType<HttpTestingController['expectOne']> {
    return backend.expectOne((request) =>
      request.url.endsWith('/solicitudes-empleado/recibidas'),
    );
  }

  function peticionDetalle(): ReturnType<HttpTestingController['expectOne']> {
    return backend.expectOne((request) =>
      /\/solicitudes-empleado\/\d+\/detalles/.test(request.url),
    );
  }

  function alternar(indice = 0): void {
    const host = fixture.nativeElement as HTMLElement;
    host.querySelectorAll<HTMLButtonElement>('.solicitud__alternar')[indice]?.click();
    fixture.detectChanges();
  }

  it('lista todas las invitaciones y carga el detalle solo al expandir', () => {
    listar().flush(RECIBIDAS);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelectorAll('app-solicitud-empleado-card')).toHaveLength(5);
    expect(host.querySelector('.panel__contador')?.textContent?.trim()).toBe('5');
    expect(host.textContent).toContain('Estado a consultar');
    expect(backend.match((request) => request.url.endsWith('/detalles'))).toHaveLength(0);
    expect(host.querySelector<HTMLAnchorElement>('.volver')?.getAttribute('href')).toBe(
      '/solicitudes',
    );

    alternar();

    expect(host.querySelector('.solicitud__cargando')).not.toBeNull();

    peticionDetalle().flush(detalle(41, 'RECHAZADA'));
    fixture.detectChanges();

    expect(host.textContent).toContain('Barbería Central');
    expect(host.textContent).toContain('Rechazada');
    expect(host.querySelector('.solicitud__cargando')).toBeNull();

    alternar();
    alternar();

    expect(backend.match((request) => request.url.endsWith('/detalles'))).toHaveLength(0);
    expect(host.textContent).toContain('Barbería Central');
  });

  it('permite aprobar una invitación pendiente desde el historial', () => {
    listar().flush([RECIBIDAS[0]]);
    fixture.detectChanges();

    alternar();
    peticionDetalle().flush(detalle(41, 'PENDIENTE'));
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const aprobar = Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find(
      (boton) => boton.textContent?.includes('Aprobar invitación'),
    );
    aprobar?.click();
    fixture.detectChanges();

    backend
      .expectOne((request) => request.url.endsWith('/solicitudes-empleado/41/aprobar'))
      .flush('Se aceptó la solicitud');
    fixture.detectChanges();

    expect(host.textContent).toContain('Aceptaste la invitación de empleo');
    expect(host.textContent).toContain('Aprobada');
  });

  it('ante un error de detalle permite reintentar sin perder la invitación', () => {
    listar().flush([RECIBIDAS[0]]);
    fixture.detectChanges();

    alternar();
    peticionDetalle().flush({}, { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('No pudimos cargar el detalle de la solicitud');
    expect(host.textContent).toContain('Barbería Central');

    const reintentar = host.querySelector<HTMLButtonElement>('.solicitud__error button');
    expect(reintentar?.textContent).toContain('Reintentar detalle');
    reintentar?.click();
    fixture.detectChanges();

    peticionDetalle().flush(detalle(41, 'APROBADA'));
    fixture.detectChanges();

    expect(host.querySelector('.solicitud__error')).toBeNull();
    expect(host.textContent).toContain('Aprobada');
  });

  it('muestra el vacío con acceso de vuelta y recupera el listado ante un error', () => {
    listar().flush({}, { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('No pudimos cargar tus solicitudes de empleo');

    host.querySelector<HTMLButtonElement>('.estado--error .boton')?.click();
    fixture.detectChanges();

    listar().flush([]);
    fixture.detectChanges();

    expect(host.textContent).toContain('Todavía no recibiste invitaciones');
    const volver = host.querySelector<HTMLAnchorElement>('.estado--vacio a.boton');
    expect(volver?.textContent).toContain('Volver a Solicitudes');
    expect(volver?.getAttribute('href')).toBe('/solicitudes');
  });
});
