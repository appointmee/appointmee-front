import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { SIN_MANEJO_GLOBAL_DE_ERRORES } from '../http/error-handling-context';
import { notificacionService } from './notificacion-service';

describe('notificacionService', () => {
  let api: notificacionService;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(notificacionService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('lista notificaciones paginadas con manejo inline de errores', () => {
    api.listar(1, 10).subscribe();

    const peticion = backend.expectOne(
      (request) =>
        request.url === 'http://localhost:8080/notificaciones' &&
        request.params.get('pagina') === '1' &&
        request.params.get('tamano') === '10',
    );
    expect(peticion.request.method).toBe('GET');
    expect(peticion.request.context.get(SIN_MANEJO_GLOBAL_DE_ERRORES)).toBe(true);
    peticion.flush({
      contenido: [],
      pagina: 1,
      tamano: 10,
      totalElementos: 0,
      totalPaginas: 0,
      noLeidas: 0,
    });
  });

  it('consulta el contador de no leídas sin aviso global', () => {
    api.contarNoLeidas().subscribe();

    const peticion = backend.expectOne('http://localhost:8080/notificaciones/no-leidas');
    expect(peticion.request.method).toBe('GET');
    expect(peticion.request.context.get(SIN_MANEJO_GLOBAL_DE_ERRORES)).toBe(true);
    peticion.flush({ noLeidas: 3 });
  });
});
