import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { servicioService } from './servicio-service';

describe('servicioService eliminar', () => {
  let service: servicioService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(servicioService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('usa DELETE en la ruta de eliminación y espera una respuesta de texto', () => {
    service.eliminar(42).subscribe(response => expect(response).toContain('el servicio'));
    const request = http.expectOne(request => request.url.endsWith('/servicios/eliminar/42'));
    expect(request.request.method).toBe('DELETE');
    request.flush('Se eliminó el servicio correctamente');
  });
});
