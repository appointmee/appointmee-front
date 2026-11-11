import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { sucursalService } from './sucursal-service';

describe('sucursalService eliminar', () => {
  let service: sucursalService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(sucursalService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('usa el endpoint administrativo para eliminar sucursal', () => {
    service.eliminar(7).subscribe(response => expect(response).toContain('sucursal'));
    const request = http.expectOne(request => request.url.endsWith('/sucursales/eliminar/7'));
    expect(request.request.method).toBe('DELETE');
    request.flush('Se eliminó la sucursal');
  });

  it('usa el endpoint que valida la propiedad del empleador', () => {
    service.eliminarPropia(8).subscribe(response => expect(response).toContain('sucursal'));
    const request = http.expectOne(request => request.url.endsWith('/sucursales/borrar-sucursal-propia/8'));
    expect(request.request.method).toBe('DELETE');
    request.flush('Se eliminó la sucursal');
  });
});
