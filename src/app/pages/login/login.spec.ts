import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { LoginPage } from './login';
import { apiErrorInterceptor } from '../../http/api-errors';

describe('LoginPage recovery', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
  });

  it('keeps both form fields and the route after a network error', async () => {
    const fixture = TestBed.createComponent(LoginPage);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const email = element.querySelector<HTMLInputElement>('input[name="email"]')!;
    const password = element.querySelector<HTMLInputElement>('input[name="pass"]')!;
    email.value = 'user@example.com';
    email.dispatchEvent(new Event('input'));
    password.value = 'draft-password';
    password.dispatchEvent(new Event('input'));
    element.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    const request = TestBed.inject(HttpTestingController).expectOne('http://localhost:8080/usuarios/inicio-sesion');
    request.error(new ProgressEvent('error'));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(email.value).toBe('user@example.com');
    expect(password.value).toBe('draft-password');
    expect(TestBed.inject(Router).url).not.toContain('/error');
    expect(element.textContent).toContain('No pudimos conectarnos');
  });
});
