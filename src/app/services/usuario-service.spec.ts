import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { usuarioService } from './usuario-service';

describe('usuarioService perfil', () => {
  let service: usuarioService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(usuarioService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('obtiene el perfil propio por id', () => {
    service.obtenerPorId(7).subscribe();
    const request = http.expectOne(request => request.url.endsWith('/usuarios/7'));
    expect(request.request.method).toBe('GET');
    request.flush({ id: 7, nombre: 'Ana' });
  });

  it('actualiza datos del perfil usando PATCH', () => {
    service.actualizar(7, { nombre: 'Ana', apellido: 'García', email: 'ana@example.com', fotoUrl: null }).subscribe();
    const request = http.expectOne(request => request.url.endsWith('/usuarios/modificar/7'));
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body.fotoUrl).toBeNull();
    request.flush('Usuario modificado');
  });

  it('elimina la foto de perfil con el endpoint específico', () => {
    service.eliminarFotoPerfil().subscribe();
    const request = http.expectOne(request => request.url.endsWith('/usuarios/eliminar/foto-perfil'));
    expect(request.request.method).toBe('DELETE');
    request.flush('Se eliminó la foto de perfil');
  });
});
