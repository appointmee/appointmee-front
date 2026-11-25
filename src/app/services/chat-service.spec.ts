import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { SIN_MANEJO_GLOBAL_DE_ERRORES } from '../http/error-handling-context';
import { chatService } from './chat-service';

describe('chatService', () => {
  let api: chatService;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(chatService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('lista las conversaciones con manejo inline de errores', () => {
    api.listar().subscribe();

    const request = backend.expectOne('http://localhost:8080/conversaciones');
    expect(request.request.method).toBe('GET');
    expect(request.request.context.get(SIN_MANEJO_GLOBAL_DE_ERRORES)).toBe(true);
    request.flush([]);
  });

  it('pide los últimos mensajes sin afterId y solo lo nuevo cuando se reconecta', () => {
    api.listarMensajes(50).subscribe();
    backend
      .expectOne(
        (request) =>
          request.url === 'http://localhost:8080/conversaciones/50/mensajes' &&
          !request.params.has('afterId'),
      )
      .flush([]);

    api.listarMensajes(50, 12).subscribe();
    const reconexion = backend.expectOne(
      (request) => request.url === 'http://localhost:8080/conversaciones/50/mensajes',
    );
    expect(reconexion.request.params.get('afterId')).toBe('12');
    expect(reconexion.request.params.get('size')).toBe('100');
    reconexion.flush([]);
  });

  it('marca la conversación como leída con PATCH', () => {
    api.marcarLeido(50).subscribe();

    const request = backend.expectOne('http://localhost:8080/conversaciones/50/leido');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.context.get(SIN_MANEJO_GLOBAL_DE_ERRORES)).toBe(true);
    request.flush({});
  });
});
