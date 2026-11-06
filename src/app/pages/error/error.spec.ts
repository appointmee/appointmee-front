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
});
