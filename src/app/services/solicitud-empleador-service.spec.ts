import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { backendService } from './backend-service';
import { solicitudEmpleadorService } from './solicitud-empleador-service';

describe('solicitudEmpleadorService · contrato de solicitudes de empleador', () => {
  let servicio: solicitudEmpleadorService;
  let backend: HttpTestingController;
  let baseUrl: string;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    servicio = TestBed.inject(solicitudEmpleadorService);
    backend = TestBed.inject(HttpTestingController);
    baseUrl = TestBed.inject(backendService).baseUrl;
  });

  afterEach(() => {
    backend.verify();
  });

  it('envía el motivo y todas las claves de las ubicaciones elegidas', () => {
    const datos = {
      motivo: 'Tengo dos sucursales y quiero gestionar sus turnos desde AppointMee.',
      ubicaciones: [
        {
          direccion: 'Av. Corrientes 1234, CABA, Argentina',
          latitud: -34.6037,
          longitud: -58.3816,
          googlePlaceId: 'ChIJ_corientes',
        },
        {
          direccion: 'Av. Santa Fe 3253, CABA, Argentina',
          latitud: -34.5889,
          longitud: -58.3951,
          googlePlaceId: 'ChIJ_santafe',
        },
      ],
    };

    servicio.solicitar(datos).subscribe();

    const peticion = backend.expectOne(`${baseUrl}/solicitudes-empleador/solicitar`);
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual(datos);
    peticion.flush('Solicitud registrada');
  });

  it('pide el listado administrativo con estado, página 0-based y tamaño 10', () => {
    servicio.listarAdministrativas('APROBADA', 2).subscribe();

    const peticion = backend.expectOne(
      (request) => request.url === `${baseUrl}/solicitudes-empleador/listar`,
    );
    expect(peticion.request.method).toBe('GET');
    expect(peticion.request.params.get('estado')).toBe('APROBADA');
    expect(peticion.request.params.get('page')).toBe('2');
    expect(peticion.request.params.get('size')).toBe('10');
    peticion.flush({
      content: [],
      totalElements: 25,
      totalPages: 3,
      number: 2,
      size: 10,
    });
  });
});
