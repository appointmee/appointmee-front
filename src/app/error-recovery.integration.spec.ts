import { Component, inject } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, RouterOutlet } from '@angular/router';
import { ApiErrors, apiErrorInterceptor } from './http/api-errors';
import { ErrorPage } from './pages/error/error';
import { Home } from './pages/home/home';
import { LoginPage } from './pages/login/login';
import { NotFoundPage } from './pages/no-encontrada/no-encontrada';
import { Sucursales } from './pages/sucursales/sucursales';
import { NavigationHistory } from './navigation-history';
import { Reporte404 } from './pages/no-encontrada/reporte-404';
import { ReporteError } from './pages/error/reporte-error';

@Component({
  standalone: true,
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
class TestShell {
  private readonly navigationHistory = inject(NavigationHistory);
}

describe('US-ERR-03 recovery flows', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<TestShell>>;
  let router: Router;
  let backend: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [TestShell],
      providers: [
        provideRouter([
          { path: '', component: Home },
          { path: 'sucursales', component: Sucursales },
          { path: 'error', component: ErrorPage },
          { path: 'login', component: LoginPage },
          { path: '**', component: NotFoundPage },
        ]),
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: Reporte404, useValue: { registrar: () => undefined } },
        { provide: ReporteError, useValue: { registrar: () => undefined } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(TestShell);
    fixture.detectChanges();
    router = TestBed.inject(Router);
    backend = TestBed.inject(HttpTestingController);
    TestBed.inject(ApiErrors);
  });

  afterEach(() => backend.verify());

  it('retries a 503 listing load once with filters, showing loading and keeping the app mounted', async () => {
    const origin = '/sucursales?busqueda=Flores&categoria=CAFE';
    await router.navigateByUrl(origin);
    fixture.detectChanges();
    backend.expectOne((request) => request.url.endsWith('/sucursales/categorias')).flush(['CAFE']);
    fixture.detectChanges();

    const failedList = backend.expectOne((request) =>
      request.url.endsWith('/sucursales/listar/filtrar'),
    );
    expect(failedList.request.params.get('nombre')).toBe('Flores');
    expect(failedList.request.params.get('categoria')).toBe('CAFE');
    failedList.flush({}, { status: 503, statusText: 'Unavailable' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(router.url).toBe(origin);
    const shell = fixture.nativeElement as HTMLElement;
    const retry = shell.querySelector<HTMLButtonElement>('button.estado__link')!;
    expect(retry.textContent).toContain('Reintentar');
    retry.click();
    fixture.detectChanges();
    expect(shell.querySelector('[aria-busy="true"]')).toBeTruthy();
    retry.click();

    const retriedRequests = backend.match((request) =>
      request.url.endsWith('/sucursales/listar/filtrar'),
    );
    expect(retriedRequests).toHaveLength(1);
    const [retriedList] = retriedRequests;
    expect(retriedList.request.params.get('nombre')).toBe('Flores');
    expect(retriedList.request.params.get('categoria')).toBe('CAFE');
    retriedList.flush([]);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(shell.querySelector<HTMLInputElement>('input[type="search"]')?.value).toBe('Flores');
    expect(shell.querySelector('[aria-pressed="true"]')?.textContent?.trim()).toBe('Cafe');
  });

  it('keeps a server failure inline without losing the listing route', async () => {
    await router.navigateByUrl('/');
    await fixture.whenStable();
    // La home carga su propio listado de sucursales al inicializarse.
    backend.match(() => true).forEach((req) => req.flush([]));
    await router.navigateByUrl('/sucursales');
    fixture.detectChanges();
    backend.expectOne((request) => request.url.endsWith('/sucursales/categorias')).flush([]);
    fixture.detectChanges();
    backend.expectOne((request) => request.url.endsWith('/sucursales/listar/filtrar'))
      .flush({}, { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(router.url).toBe('/sucursales');
    expect((fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')).toBeTruthy();
  });

  it('keeps a 401 inline with a login action and the filtered source route', async () => {
    const origin = '/sucursales?busqueda=Flores&categoria=CAFE';
    await router.navigateByUrl(origin);
    fixture.detectChanges();
    backend.expectOne((request) => request.url.endsWith('/sucursales/categorias')).flush(['CAFE']);
    fixture.detectChanges();
    backend.expectOne((request) => request.url.endsWith('/sucursales/listar/filtrar'))
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(router.url).toBe(origin);
    const element = fixture.nativeElement as HTMLElement;
    const login = element.querySelector<HTMLAnchorElement>('a.estado__link');
    expect(login?.textContent).toContain('Iniciar sesión');
    expect(login?.getAttribute('href')).toBe('/login');
  });
});
