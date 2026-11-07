import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { ErrorPage } from './error';

@Component({ standalone: true, template: '' })
class TestRoute {}

describe('ErrorPage', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ErrorPage],
      providers: [provideRouter([{ path: 'private', component: TestRoute }])],
    }).compileComponents();
  });

  it('shows a safe public error message and always offers a way home', async () => {
    const fixture = TestBed.createComponent(ErrorPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const html = fixture.nativeElement as HTMLElement;
    expect(html.querySelector('h1')?.textContent).toContain('Algo salió mal');
    expect(html.querySelector('a[routerLink="/"]')?.textContent).toContain('Ir al inicio');
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
    // Sin returnTo (sin historial): solo 'Volver' + 'Ir al inicio' = 2 acciones.
    const fixture = TestBed.createComponent(ErrorPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const html = fixture.nativeElement as HTMLElement;
    const actions = html.querySelector('.error-card__actions');
    const buttons = actions?.querySelectorAll('button, a') ?? [];
    expect(buttons.length).toBeGreaterThanOrEqual(2);

    // Con returnTo seguro y estado recuperable: 'Reintentar' + 'Volver' + 'Ir al inicio' = 3.
    history.replaceState({ status: 503, returnTo: '/private' }, '');
    const fixture2 = TestBed.createComponent(ErrorPage);
    fixture2.detectChanges();
    await fixture2.whenStable();

    const html2 = fixture2.nativeElement as HTMLElement;
    const actions2 = html2.querySelector('.error-card__actions');
    const buttons2 = actions2?.querySelectorAll('button, a') ?? [];
    expect(buttons2.length).toBeGreaterThanOrEqual(2);
  });

  it('is public and does not require authentication', () => {
    // La ruta /error no tiene authGuard: se renderiza incluso como visitante.
    const fixture = TestBed.createComponent(ErrorPage);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('h1')).not.toBeNull();
  });
});
