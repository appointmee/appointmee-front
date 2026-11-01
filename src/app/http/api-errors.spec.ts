import { Location } from '@angular/common';
import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiErrors, apiErrorInterceptor } from './api-errors';
import { Auth } from '../auth/auth';

@Component({ standalone: true, template: '' })
class TestRoute {}

describe('ApiErrors', () => {
  let errors: ApiErrors;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [ApiErrors] });
    errors = TestBed.inject(ApiErrors);
  });

  it('maps known statuses to actionable safe messages', () => {
    expect(errors.map(new HttpErrorResponse({ status: 403 })).message)
      .toBe('No tenés permisos para realizar esta acción.');
    expect(errors.map(new HttpErrorResponse({ status: 404 })).message)
      .toBe('No encontramos lo que buscabas.');
    expect(errors.map(new HttpErrorResponse({ status: 429, error: 'private backend text' })).message)
      .toBe('Demasiados intentos. Esperá unos segundos e intentá de nuevo.');
    expect(errors.map(new HttpErrorResponse({ status: 503 })).message)
      .toBe('Tuvimos un problema. Probá de nuevo en unos segundos.');
    expect(errors.map(new HttpErrorResponse({ status: 0 })).message)
      .toBe('No pudimos conectarnos. Revisá tu conexión.');
  });

  it('maps 401 to a safe session message', () => {
    expect(errors.map(new HttpErrorResponse({ status: 401, error: 'technical details' })).message)
      .toBe('Tu sesión expiró. Iniciá sesión para continuar.');
  });

  it('keeps validation errors structured and never exposes unknown backend text', () => {
    const validation = errors.map(new HttpErrorResponse({
      status: 422,
      error: { fields: { email: 'Formato inválido', ignored: 9 } },
    }));
    expect(validation.fields).toEqual({
      email: 'Revisá el formato del email e intentá nuevamente.',
      ignored: 'Revisá este campo e intentá nuevamente.',
    });

    const unknown = errors.map(new HttpErrorResponse({ status: 418, error: 'SQL SELECT secret' }));
    expect(unknown.message).toContain('Ocurrió un error inesperado');
    expect(unknown.message).not.toContain('SQL');
  });

  it('maps known plain-text conflicts to a safe contextual email error', () => {
    const conflict = errors.map(new HttpErrorResponse({
      status: 409,
      error: 'El email ya está registrado en el sistema. Detalle SQL: private data',
    }));
    expect(conflict.fields).toEqual({ email: 'Este email ya está registrado.' });
    expect(conflict.message).toBe('Este email ya está registrado.');
    expect(conflict.message).not.toContain('SQL');
  });
});

describe('apiErrorInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let errors: ApiErrors;
  let router: Router;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'login', component: TestRoute },
          { path: 'private', component: TestRoute },
          { path: 'error', component: TestRoute },
        ]),
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    errors = TestBed.inject(ApiErrors);
    router = TestBed.inject(Router);
  });

  afterEach(() => backend.verify());

  it('keeps field validation errors out of the global error notice', async () => {
    http.get('/api/form').subscribe({ error: () => undefined });
    backend.expectOne('/api/form').flush({ email: 'raw backend detail' }, { status: 422, statusText: 'Unprocessable' });
    await Promise.resolve();
    expect(errors.notice()).toBeNull();
  });

  it('routes a failed GET to the error view with its original URL for retry', async () => {
    await router.navigateByUrl('/private?tab=history');
    http.get('/api/data').subscribe({ error: () => undefined });
    backend.expectOne('/api/data').flush({}, { status: 503, statusText: 'Unavailable' });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(router.url).toBe('/error');
    const navigationState = TestBed.inject(Location).getState() as Record<string, unknown>;
    expect(navigationState['returnTo']).toBe('/private?tab=history');
    expect(navigationState['status']).toBe(503);
    expect(errors.notice()).toBeNull();
  });

  it('does not navigate or retry a failed POST, preserving the current form route', async () => {
    await router.navigateByUrl('/private?step=details');
    http.post('/api/operation', { note: 'draft' }).subscribe({ error: () => undefined });
    backend.expectOne('/api/operation').flush({}, { status: 503, statusText: 'Unavailable' });
    await Promise.resolve();

    expect(router.url).toBe('/private?step=details');
    expect(errors.notice()?.error.status).toBe(503);
  });

  it('clears an authenticated session and redirects to login with the current URL', async () => {
    TestBed.inject(Auth);
    localStorage.setItem('token', 'expired-token');
    await router.navigateByUrl('/private?tab=history');

    http.get('/api/private', { headers: { Authorization: 'Bearer expired-token' } }).subscribe({ error: () => undefined });
    backend.expectOne('/api/private').flush({}, { status: 401, statusText: 'Unauthorized' });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(localStorage.getItem('token')).toBeNull();
    expect(router.url).toContain('/login?');
    expect(router.url).toContain('returnTo=%2Fprivate%3Ftab%3Dhistory');
    expect(router.url).toContain('expired=1');
  });
});
