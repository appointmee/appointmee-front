import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ServicioPayload } from '../models/servicio';
import { servicioService } from './servicio-service';

describe('servicioService mutations', () => {
  let service: servicioService;
  let http: HttpTestingController;

  const payload: ServicioPayload = {
    sucursalId: 5,
    nombre: 'Corte',
    descripcion: 'Corte clásico',
    duracion: 30,
    precio: 1000,
    fotoPerfil: null,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(servicioService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('crea un servicio mediante el endpoint protegido de creación', () => {
    service.crear(payload).subscribe();

    const request = http.expectOne(request => request.url.endsWith('/servicios/crear'));
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(payload);
    request.flush({ id: 1 });
  });

  it('actualiza un servicio mediante PATCH y su ruta real', () => {
    service.actualizar(9, payload).subscribe();

    const request = http.expectOne(request => request.url.endsWith('/servicios/modificar/9'));
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual(payload);
    request.flush({ id: 9 });
  });
});
