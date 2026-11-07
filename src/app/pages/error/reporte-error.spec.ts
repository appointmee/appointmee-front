import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SIN_MANEJO_GLOBAL_DE_ERRORES } from '../../http/error-handling-context';
import { ReporteError } from './reporte-error';

describe('ReporteError', () => {
  let reporter: ReporteError;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    reporter = TestBed.inject(ReporteError);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('envía contexto mínimo sin datos personales ni mensajes crudos', () => {
    reporter.registrar({ code: 'HTTP_503', status: 503 }, 'ref-123');

    const request = http.expectOne((req) => req.url.endsWith('/observabilidad/error'));
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      screen: 'error',
      reference: 'ref-123',
      code: 'HTTP_503',
      status: 503,
    });
    expect(request.request.context.get(SIN_MANEJO_GLOBAL_DE_ERRORES)).toBe(true);
    request.flush({ ok: true });
  });

  it('no propaga fallas del servicio de observabilidad a la pantalla', () => {
    reporter.registrar({ code: 'NETWORK_ERROR', status: 0 }, null);
    http.expectOne((req) => req.url.endsWith('/observabilidad/error'))
      .flush({}, { status: 503, statusText: 'Unavailable' });
  });
});
