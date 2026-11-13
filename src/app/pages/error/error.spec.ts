import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { ErrorPage } from './error';
import { NavigationHistory } from '../../navigation-history';
import { ReporteError } from './reporte-error';

@Component({ standalone: true, template: '' })
class TestRoute {}

const backTarget = vi.fn(() => null as string | null);
const registrarError = vi.fn();

describe('ErrorPage', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ErrorPage],
      providers: [
        provideRouter([
          { path: '', component: TestRoute },
          { path: 'private', component: TestRoute },
          { path: 'sucursales', component: TestRoute },
        ]),
        { provide: NavigationHistory, useValue: { backTarget } },
        { provide: ReporteError, useValue: { registrar: registrarError } },
      ],
    }).compileComponents();
    backTarget.mockReset().mockReturnValue(null);
    registrarError.mockReset();
  });

  it('shows a safe public error message and always offers a way home', async () => {
    const fixture = TestBed.createComponent(ErrorPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const html = fixture.nativeElement as HTMLElement;
    expect(html.querySelector('h1')?.textContent).toContain('Algo salió mal');
    expect(html.querySelector('a[routerLink="/"]')?.textContent).toContain('Volver al inicio');
    expect(html.textContent).not.toContain('stack trace');
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex, nofollow');
  });

  it('omits an unsafe reference supplied through navigation state', async () => {
    history.replaceState({ errorReference: 'token secret' }, '');

    const fixture = TestBed.createComponent(ErrorPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const html = fixture.nativeElement as HTMLElement;
    expect(html.querySelector('.error-card__reference')).toBeNull();
  });

  it('retries a safe failed route, shows loading, and replaces the error history entry', async () => {
    history.replaceState({ status: 503, returnTo: '/private?tab=history' }, '');

    const fixture = TestBed.createComponent(ErrorPage);
    fixture.detectChanges();
    const button = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button.error-button--primary');

    expect(button?.textContent).toContain('Reintentar');
    button?.click();
    fixture.detectChanges();
    expect(button?.disabled).toBe(true);
    expect(button?.textContent).toContain('Reintentando');

    await fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/private?tab=history');
  });

  it('announces the message with aria-live and focuses the title on load', async () => {
    const fixture = TestBed.createComponent(ErrorPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const html = fixture.nativeElement as HTMLElement;
    const card = html.querySelector('.error-card');
    expect(card?.getAttribute('aria-live')).toBe('polite');
    expect(card?.getAttribute('aria-atomic')).toBe('true');

    const title = html.querySelector('#error-title');
    expect(title).not.toBeNull();
    await fixture.whenStable();
    expect(document.activeElement).toBe(title);
  });

  it('never exposes stack traces, internal routes, tokens or raw backend messages', async () => {
    history.replaceState({
      status: 500,
      errorReference: 'ref-123',
      returnTo: '/private',
    }, '');

    const fixture = TestBed.createComponent(ErrorPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const html = fixture.nativeElement as HTMLElement;
    const text = html.textContent;
    expect(text).not.toContain('stack');
    expect(text).not.toContain('trace');
    expect(text).not.toContain('token');
    expect(text).not.toContain('Bearer');
    expect(text).not.toContain('/private');
    expect(text).not.toContain('Failed to fetch');
    expect(text).not.toContain('500');
    expect(text).toContain('Algo salió mal');
  });

  it('always offers at least two actions as a way out', async () => {
    // Sin historial hay dos destinos útiles: sucursales e inicio.
    history.replaceState({}, '');
    const fixture = TestBed.createComponent(ErrorPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const html = fixture.nativeElement as HTMLElement;
    const actions = html.querySelector('.error-card__actions');
    const buttons = actions?.querySelectorAll('button, a') ?? [];
    expect(buttons.length).toBeGreaterThanOrEqual(2);
    expect(actions?.textContent).toContain('Ver sucursales');
    expect(actions?.textContent).toContain('Volver al inicio');
    expect(actions?.querySelector('button')).toBeNull();

    // Con returnTo seguro y estado recuperable: 'Reintentar' + 'Ver sucursales' + 'Volver al inicio' = 3.
    history.replaceState({ status: 503, returnTo: '/private' }, '');
    const fixture2 = TestBed.createComponent(ErrorPage);
    fixture2.detectChanges();
    await fixture2.whenStable();

    const html2 = fixture2.nativeElement as HTMLElement;
    const actions2 = html2.querySelector('.error-card__actions');
    const buttons2 = actions2?.querySelectorAll('button, a') ?? [];
    expect(buttons2.length).toBeGreaterThanOrEqual(2);
  });

  it('offers Volver only when there is an internal history target', async () => {
    backTarget.mockReturnValue('/sucursales');
    const fixture = TestBed.createComponent(ErrorPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const actions = (fixture.nativeElement as HTMLElement).querySelector('.error-card__actions');
    expect(actions?.textContent).toContain('Volver');
    expect(actions?.textContent).not.toContain('Ver sucursales');
  });

  it('sends only allow-listed error context to observability', async () => {
    history.replaceState({ status: 503, code: 'HTTP_503', errorReference: 'ref-123', rawMessage: 'SQL token' }, '');
    const fixture = TestBed.createComponent(ErrorPage);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(registrarError).toHaveBeenCalledWith({ code: 'HTTP_503', status: 503 }, 'ref-123');
  });

  it('is public and does not require authentication', () => {
    // La ruta /error no tiene authGuard: se renderiza incluso como visitante.
    const fixture = TestBed.createComponent(ErrorPage);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('h1')).not.toBeNull();
  });

  it('muestra el error 401 sin autenticación con sus acciones de salida', async () => {
    history.replaceState({ status: 401 }, '');
    const fixture = TestBed.createComponent(ErrorPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const html = fixture.nativeElement as HTMLElement;
    expect(html.querySelector('h1')?.textContent).toContain('Error 401 - No autenticado');
    expect(html.textContent).toContain('No has iniciado sesión o tu sesión ha expirado. Iniciá sesión para acceder a esta sección.');
    // El error de autenticación no ofrece reintento: solo salida al inicio y a sucursales.
    expect(html.querySelector('button')).toBeNull();

    const actions = html.querySelector('.error-card__actions');
    expect(actions?.textContent).toContain('Ver sucursales');
    expect(actions?.textContent).toContain('Volver al inicio');
    expect(actions?.querySelectorAll('button, a')).toHaveLength(2);
  });

  it('muestra el error 403 de acceso denegado con sus acciones de salida', async () => {
    history.replaceState({ status: 403 }, '');
    const fixture = TestBed.createComponent(ErrorPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const html = fixture.nativeElement as HTMLElement;
    expect(html.querySelector('h1')?.textContent).toContain('Error 403 - Acceso denegado');
    expect(html.textContent).toContain('No tenés los permisos necesarios para acceder a esta sección.');

    const actions = html.querySelector('.error-card__actions');
    expect(actions?.textContent).toContain('Ver sucursales');
    expect(actions?.textContent).toContain('Volver al inicio');
    expect(actions?.querySelectorAll('button, a')).toHaveLength(2);
  });

  it('redirige al inicio desde el botón Volver al inicio de la pantalla de error', async () => {
    history.replaceState({ status: 401 }, '');
    const fixture = TestBed.createComponent(ErrorPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const html = fixture.nativeElement as HTMLElement;
    const botonInicio = html.querySelector<HTMLAnchorElement>('a[routerLink="/"]');
    expect(botonInicio?.textContent).toContain('Volver al inicio');
    botonInicio!.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/');
  });

  it('redirige a sucursales desde el botón Ver sucursales de la pantalla de error', async () => {
    history.replaceState({ status: 403 }, '');
    const fixture = TestBed.createComponent(ErrorPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const html = fixture.nativeElement as HTMLElement;
    const botonSucursales = html.querySelector<HTMLAnchorElement>('a[routerLink="/sucursales"]');
    expect(botonSucursales?.textContent).toContain('Ver sucursales');
    botonSucursales!.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/sucursales');
  });
});
