import {
  HttpClient,
  HttpErrorResponse,
  HttpHeaders,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { apiErrorsService, apiErrorInterceptor } from './api-errors-service';

@Component({ standalone: true, template: '' })
class TestRoute {}

describe('apiErrorsService', () => {
  let errors: apiErrorsService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [apiErrorsService] });
    errors = TestBed.inject(apiErrorsService);
  });

  it('conserva el código seguro de email pendiente y Retry-After', () => {
    const error = errors.map(new HttpErrorResponse({
      status: 403, error: { code: 'EMAIL_NOT_VERIFIED', message: 'private detail' },
      headers: new HttpHeaders({ 'Retry-After': '60' }),
    }));
    expect(error.code).toBe('EMAIL_NOT_VERIFIED');
    expect(error.retryAfterSeconds).toBe(60);
    expect(error.message).not.toContain('private detail');
  });

  it('maps known statuses to actionable safe messages', () => {
    expect(errors.map(new HttpErrorResponse({ status: 403 })).message).toBe(
      'No tenés permisos para realizar esta acción.',
    );
    expect(errors.map(new HttpErrorResponse({ status: 404 })).message).toBe(
      'No encontramos lo que buscabas.',
    );
    expect(
      errors.map(new HttpErrorResponse({ status: 429, error: 'private backend text' })).message,
    ).toBe('Demasiados intentos. Esperá unos segundos e intentá de nuevo.');
    expect(errors.map(new HttpErrorResponse({ status: 503 })).message).toBe(
      'Tuvimos un problema. Probá de nuevo en unos segundos.',
    );
    expect(errors.map(new HttpErrorResponse({ status: 0 })).message).toBe(
      'No pudimos conectarnos. Revisá tu conexión.',
    );
  });

  it('maps 401 to a safe session message', () => {
    expect(
      errors.map(new HttpErrorResponse({ status: 401, error: 'technical details' })).message,
    ).toBe('Tu sesión expiró. Iniciá sesión para continuar.');
  });

  it('keeps validation errors structured and never exposes unknown backend text', () => {
    const validation = errors.map(
      new HttpErrorResponse({
        status: 422,
        error: { fields: { email: 'Formato inválido', ignored: 9 } },
      }),
    );
    expect(validation.fields).toEqual({
      email: 'Revisá el formato del email e intentá nuevamente.',
      ignored: 'Revisá este campo e intentá nuevamente.',
    });

    const unknown = errors.map(new HttpErrorResponse({ status: 418, error: 'SQL SELECT secret' }));
    expect(unknown.message).toContain('Ocurrió un error inesperado');
    expect(unknown.message).not.toContain('SQL');
  });

  it('maps known plain-text conflicts to a safe contextual email error', () => {
    const conflict = errors.map(
      new HttpErrorResponse({
        status: 409,
        error: 'El email ya está registrado en el sistema. Detalle SQL: private data',
      }),
    );
    expect(conflict.fields).toEqual({ email: 'Este email ya está registrado.' });
    expect(conflict.message).toBe('Este email ya está registrado.');
    expect(conflict.message).not.toContain('SQL');
  });
});

describe('apiErrorInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let errors: apiErrorsService;
  let router: Router;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'login', component: TestRoute },
          { path: 'private', component: TestRoute },
        ]),
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    errors = TestBed.inject(apiErrorsService);
    router = TestBed.inject(Router);
  });

  afterEach(() => backend.verify());

  it('keeps field validation errors out of the global error notice', async () => {
    http.get('/api/form').subscribe({ error: () => undefined });
    backend
      .expectOne('/api/form')
      .flush({ email: 'raw backend detail' }, { status: 422, statusText: 'Unprocessable' });
    await Promise.resolve();
    expect(errors.notice()).toBeNull();
  });

  it('replays a failed server request once and clears the notice on success', async () => {
    http.get('/api/data').subscribe({ error: () => undefined });
    backend.expectOne('/api/data').flush({}, { status: 503, statusText: 'Unavailable' });
    await Promise.resolve();
    expect(errors.notice()?.error.message).toBe(
      'Tuvimos un problema. Probá de nuevo en unos segundos.',
    );

    errors.notice()?.retry?.();
    backend.expectOne('/api/data').flush({ ok: true });
    await Promise.resolve();
    expect(errors.notice()).toBeNull();
  });
});
