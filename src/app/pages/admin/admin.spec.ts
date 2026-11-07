import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SolicitudEmpleadorDetalleDTO } from '../../models/solicitud-empleador';
import { Administracion } from './admin';

const SOLICITUDES = [
  { id: 31, nombreUsuario: 'Ana', apellidoUsuario: 'Pérez', fechaSolicitud: '2026-11-01' },
  { id: 32, nombreUsuario: 'Bruno', apellidoUsuario: 'Gómez', fechaSolicitud: '2026-10-30' },
];

function detalle(
  id: number,
  estado: SolicitudEmpleadorDetalleDTO['estado'],
): SolicitudEmpleadorDetalleDTO {
  return {
    id,
    motivo: `Motivo de la solicitud ${id}`,
    estado,
    fechaSolicitud: '2026-11-01',
    // El backend devuelve el usuario que consulta; el panel debe priorizar al solicitante del listado.
    usuario: {
      id: 99,
      nombre: 'Admin',
      apellido: 'Root',
      email: 'admin@example.com',
      urlFotoPerfil: null,
    },
  };
}

describe('Administración · solicitudes de empleador', () => {
  let fixture: ComponentFixture<Administracion>;
  let backend: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Administracion],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(Administracion);
    fixture.detectChanges();
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    fixture.destroy();
    backend.verify();
  });

  function listar(): ReturnType<HttpTestingController['expectOne']> {
    return backend.expectOne((request) =>
      request.url.endsWith('/solicitudes-empleador/listar'),
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

  it('lista pendientes con los datos del solicitante y resuelve solo después de cargar el detalle', () => {
    listar().flush(SOLICITUDES);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelectorAll('app-solicitud-empleador-card')).toHaveLength(2);
    expect(host.querySelector('.panel__contador')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      '2 pendientes',
    );
    expect(host.textContent).toContain('Ana Pérez');
    expect(host.textContent).toContain('Pendiente');
    expect(host.querySelector('.solicitud__accion')).toBeNull();
    expect(backend.match((request) => request.url.endsWith('/detalles'))).toHaveLength(0);

    alternar();

    peticionDetalle().flush(detalle(31, 'PENDIENTE'));
    fixture.detectChanges();

    expect(host.textContent).toContain('Motivo de la solicitud 31');
    expect(host.textContent).toContain('Ana Pérez');
    expect(host.textContent).not.toContain('Admin Root');
    expect(host.querySelector('.solicitud__accion--aprobar')?.textContent).toContain(
      'Aprobar solicitud',
    );
    expect(host.querySelector('.solicitud__accion--rechazar')?.textContent).toContain('Rechazar');
  });

  it('aprueba una solicitud pendiente, actualiza el estado y quita las acciones', () => {
    listar().flush([SOLICITUDES[0]]);
    fixture.detectChanges();
    alternar();
    peticionDetalle().flush(detalle(31, 'PENDIENTE'));
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    host.querySelector<HTMLButtonElement>('.solicitud__accion--aprobar')?.click();
    fixture.detectChanges();

    const peticion = backend.expectOne((request) =>
      request.url.endsWith('/solicitudes-empleador/31/aprobar'),
    );
    expect(peticion.request.method).toBe('PATCH');

    const aprobar = host.querySelector<HTMLButtonElement>('.solicitud__accion--aprobar');
    expect(aprobar?.disabled).toBe(true);
    expect(aprobar?.textContent).toContain('Aprobando');

    peticion.flush('Se aprobó la solicitud');
    fixture.detectChanges();

    expect(host.textContent).toContain('La solicitud fue aprobada');
    expect(host.querySelector('.solicitud__resumen .estado')?.textContent).toContain('Aprobada');
    expect(host.querySelector('.solicitud__accion')).toBeNull();
    expect(host.textContent).toContain('ya está resuelta');
    expect(host.querySelector('.panel__contador')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      '0 pendientes',
    );
  });

  it('ante un error al rechazar muestra el mensaje inline y permite volver a intentar', () => {
    listar().flush([SOLICITUDES[0]]);
    fixture.detectChanges();
    alternar();
    peticionDetalle().flush(detalle(31, 'PENDIENTE'));
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const rechazar = host.querySelector<HTMLButtonElement>('.solicitud__accion--rechazar');
    rechazar?.click();
    fixture.detectChanges();

    backend
      .expectOne((request) => request.url.endsWith('/solicitudes-empleador/31/rechazar'))
      .flush('Solo se pueden rechazar solicitudes pendientes', {
        status: 409,
        statusText: 'Conflict',
      });
    fixture.detectChanges();

    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      'Solo se pueden rechazar solicitudes pendientes',
    );
    expect(host.querySelector('.solicitud__accion--rechazar')).not.toBeNull();
    expect(
      host.querySelector<HTMLButtonElement>('.solicitud__accion--rechazar')?.disabled,
    ).toBe(false);
  });

  it('no ofrece acciones cuando el detalle ya está resuelto', () => {
    listar().flush([SOLICITUDES[0]]);
    fixture.detectChanges();
    alternar();
    peticionDetalle().flush(detalle(31, 'APROBADA'));
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.solicitud__accion')).toBeNull();
    expect(host.textContent).toContain('ya está resuelta');
  });

  it('muestra el vacío cuando no hay pendientes', () => {
    listar().flush([]);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('No hay solicitudes pendientes');
    expect(host.querySelector('.panel__contador')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      '0 pendientes',
    );
  });

  it('ante un error de carga muestra el error inline y reintenta', () => {
    listar().flush({}, { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('No pudimos cargar las solicitudes');

    host.querySelector<HTMLButtonElement>('.estado--error .boton')?.click();
    fixture.detectChanges();

    listar().flush([SOLICITUDES[0]]);
    fixture.detectChanges();

    expect(host.querySelector('.estado--error')).toBeNull();
    expect(host.textContent).toContain('Ana Pérez');
  });
});
