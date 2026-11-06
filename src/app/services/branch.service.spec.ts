import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { backendService } from './backend-service';
import { BranchService } from './branch.service';

describe('BranchService', () => {
  let service: BranchService;
  let http: HttpTestingController;
  let apiUrl: string;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(BranchService);
    http = TestBed.inject(HttpTestingController);
    apiUrl = TestBed.inject(backendService).baseUrl;
  });

  afterEach(() => http.verify());

  it('uses the complete listing when there are no filters', () => {
    service.list().subscribe();

    const request = http.expectOne(`${apiUrl}/sucursales/listar`);
    expect(request.request.method).toBe('GET');
    expect(request.request.params.keys()).toEqual([]);
    request.flush([]);
  });

  it('combines the trimmed name and category with HttpParams', () => {
    service.list({ nombre: '  Centro  ', categoria: 'SPA' }).subscribe();

    const request = http.expectOne(
      (candidate) => candidate.url === `${apiUrl}/sucursales/listar/filtrar`,
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('nombre')).toBe('Centro');
    expect(request.request.params.get('categoria')).toBe('SPA');
    request.flush([]);
  });
});
