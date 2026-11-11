import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { SucursalPayload } from '../models/sucursal';
import { sucursalService } from './sucursal-service';

describe('sucursalService actualizar', () => {
  let service: sucursalService;
  let http: HttpTestingController;
  const payload: SucursalPayload = {
    nombre: 'Sucursal Centro', direccion: 'Av. Corrientes 1234', telefono: '1122334455',
    descripcion: 'Sucursal principal de atención', categoria: null,
    horaApertura: '09:00', horaCierre: '18:00', diasApertura: null,
    fotoPerfil: 'https://example.com/foto.jpg',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(sucursalService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('usa PATCH y mapea fotoPerfil al nombre esperado por el backend', () => {
    service.actualizar(5, payload).subscribe();
    const request = http.expectOne(request => request.url.endsWith('/sucursales/modificar/5'));
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body.fotoUrl).toBe(payload.fotoPerfil);
    expect(request.request.body).not.toHaveProperty('categoria');
    request.flush('Sucursal modificada');
  });
});
