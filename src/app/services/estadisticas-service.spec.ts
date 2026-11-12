import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { backendService } from './backend-service';
import { estadisticasService } from './estadisticas-service';

describe('estadisticasService', () => {
  let service: estadisticasService;
  let http: HttpTestingController;
  let apiUrl: string;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(estadisticasService);
    http = TestBed.inject(HttpTestingController);
    apiUrl = TestBed.inject(backendService).baseUrl;
  });

  afterEach(() => http.verify());

  it('consulta los gráficos globales del administrador con filtros', () => {
    service.administrador('2026-01-01', '2026-01-31', 'MES').subscribe();

    const request = http.expectOne(`${apiUrl}/graficos/administrador?desde=2026-01-01&hasta=2026-01-31&agrupacion=MES`);
    expect(request.request.method).toBe('GET');
    request.flush({});
  });

  it('consulta los gráficos de la sucursal del empleador', () => {
    service.empleador(12, '2026-02-01', '2026-02-28', 'SEMANA').subscribe();

    const request = http.expectOne((candidate) => candidate.url === `${apiUrl}/graficos/empleador`);
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('sucursalId')).toBe('12');
    expect(request.request.params.get('desde')).toBe('2026-02-01');
    expect(request.request.params.get('hasta')).toBe('2026-02-28');
    expect(request.request.params.get('agrupacion')).toBe('SEMANA');
    request.flush({});
  });
});
