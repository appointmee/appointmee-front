import { Component, inject } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, RouterOutlet } from '@angular/router';
import { ApiErrors, apiErrorInterceptor } from './http/api-errors';
import { Auth } from './auth/auth';
import { ErrorPage } from './pages/error/error';
import { Home } from './pages/home/home';
import { LoginPage } from './pages/login/login';
import { NotFoundPage } from './pages/no-encontrada/no-encontrada';
import { Sucursales } from './pages/sucursales/sucursales';
import { NavigationHistory } from './navigation-history';
import { Reporte404 } from './pages/no-encontrada/reporte-404';

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

    const failedList = backend.expectOne((request) => request.url.endsWith('/sucursales/listar/filtrar'));
    expect(failedList.request.params.get('nombre')).toBe('Flores');
    expect(failedList.request.params.get('categoria')).toBe('CAFE');
    failedList.flush({}, { status: 503, statusText: 'Unavailable' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(router.url).toBe('/error');
    const shell = fixture.nativeElement as HTMLElement;
    const retry = shell.querySelector<HTMLButtonElement>('.error-button--primary')!;
    expect(retry.textContent).toContain('Reintentar');
    retry.click();
    fixture.detectChanges();
    expect(retry.disabled).toBe(true);
    expect(retry.textContent).toContain('Reintentando');
    retry.click();

    await fixture.whenStable();
    fixture.detectChanges();
    expect(router.url).toBe(origin);
    backend.expectOne((request) => request.url.endsWith('/sucursales/categorias')).flush(['CAFE']);
    const retriedList = backend.expectOne((request) => request.url.endsWith('/sucursales/listar/filtrar'));
    expect(retriedList.request.params.get('nombre')).toBe('Flores');
    expect(retriedList.request.params.get('categoria')).toBe('CAFE');
    retriedList.flush([]);
    await fixture.whenStable();
    fixture.detectChanges();

    expect((shell.querySelector<HTMLInputElement>('input[type="search"]'))?.value).toBe('Flores');
    expect(shell.querySelector('[aria-pressed="true"]')?.textContent?.trim()).toBe('Cafe');
  });

  it('returns to the previous internal route after a failure instead of looping to its failed origin', async () => {
    await router.navigateByUrl('/');
    await router.navigateByUrl('/sucursales');
    fixture.detectChanges();
    backend.expectOne((request) => request.url.endsWith('/sucursales/categorias')).flush([]);
    backend.expectOne((request) => request.url.endsWith('/sucursales/listar/filtrar'))
      .flush({}, { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(router.url).toBe('/error');

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.error-card__actions button:not(.error-button--primary)')!.click();
    await fixture.whenStable();
    expect(router.url).toBe('/');
  });

  it('takes a 401 through login and returns to the filtered source route', async () => {
    TestBed.inject(Auth);
    localStorage.setItem('token', 'expired-token');

    const origin = '/sucursales?busqueda=Flores&categoria=CAFE';
    await router.navigateByUrl(origin);
    fixture.detectChanges();
    backend.expectOne((request) => request.url.endsWith('/sucursales/categorias')).flush(['CAFE']);
    backend.expectOne((request) => request.url.endsWith('/sucursales/listar/filtrar'))
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(router.parseUrl(router.url).root.children['primary'].segments.map((segment) => segment.path).join('/')).toBe('login');
    expect(router.parseUrl(router.url).queryParams['returnTo']).toBe(origin);
    const element = fixture.nativeElement as HTMLElement;
    const email = element.querySelector<HTMLInputElement>('input[name="email"]')!;
    const password = element.querySelector<HTMLInputElement>('input[name="pass"]')!;
    email.value = 'user@example.com';
    email.dispatchEvent(new Event('input'));
    password.value = 'safe-password';
    password.dispatchEvent(new Event('input'));
    element.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    backend.expectOne('http://localhost:8080/usuarios/inicio-sesion').flush({ token: 'fresh-token' });
    backend.expectOne('http://localhost:8080/usuarios/me').flush({ id: 7, roles: ['CLIENTE'], fotoPerfil: null });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(router.url).toBe(origin);
    backend.expectOne((request) => request.url.endsWith('/sucursales/categorias')).flush(['CAFE']);
    const restoredList = backend.expectOne((request) => request.url.endsWith('/sucursales/listar/filtrar'));
    expect(restoredList.request.params.get('nombre')).toBe('Flores');
    expect(restoredList.request.params.get('categoria')).toBe('CAFE');
    restoredList.flush([]);
  });
});
