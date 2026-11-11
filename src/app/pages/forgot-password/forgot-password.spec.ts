import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { authService } from '../../services/auth-service';
import { ForgotPasswordPage } from './forgot-password';

describe('Recuperar contraseña', () => {
  let fixture: ComponentFixture<ForgotPasswordPage>;
  let page: ForgotPasswordPage;
  let backend: HttpTestingController;
  let html: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ForgotPasswordPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(ForgotPasswordPage);
    page = fixture.componentInstance;
    backend = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    html = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  function enviar(): void {
    page.onSubmit(new Event('submit', { cancelable: true }));
    fixture.detectChanges();
  }

  function completarEmail(valor = 'ana@example.com'): void {
    page.recoveryModel.set({ email: valor });
    fixture.detectChanges();
  }

  it('valida el email antes de enviar', () => {
    completarEmail('no-es-email');
    enviar();
    expect(backend.match(() => true)).toHaveLength(0);
    expect(html.textContent).toContain('Ingresá un email válido');
  });

  it('muestra el mismo mensaje genérico tras un envío exitoso', () => {
    completarEmail();
    enviar();
    backend.expectOne((r) => r.url.endsWith('/auth/forgot-password')).flush({ message: 'ok' });
    fixture.detectChanges();

    expect(html.textContent).toContain('Si el email está registrado, te enviamos un código de 6 dígitos. Revisá también spam.');
    expect(page.enviado()).toBe(true);
  });

  it('muestra un error de demasiados intentos ante 429', () => {
    completarEmail();
    enviar();
    backend.expectOne((r) => r.url.endsWith('/auth/forgot-password')).flush(null, { status: 429, statusText: 'Too Many' });
    fixture.detectChanges();

    expect(html.querySelector('[role="alert"]')?.textContent).toContain('Demasiados intentos');
    expect(page.puedeReintentar()).toBe(true);
  });

  it('muestra error inline con reintento ante error de red', () => {
    completarEmail();
    enviar();
    backend.expectOne((r) => r.url.endsWith('/auth/forgot-password')).flush(null, { status: 0, statusText: 'Error' });
    fixture.detectChanges();

    expect(html.querySelector('[role="alert"]')?.textContent).toContain('No pudimos procesar la solicitud');
    expect(page.puedeReintentar()).toBe(true);

    const reintentar = Array.from(html.querySelectorAll('button')).find((b) => b.textContent?.includes('Reintentar')) as HTMLButtonElement;
    reintentar.click();
    fixture.detectChanges();

    backend.expectOne((r) => r.url.endsWith('/auth/forgot-password')).flush({ message: 'ok' });
    fixture.detectChanges();
    expect(page.enviado()).toBe(true);
  });

  it('conserva el email ingresado ante un error', () => {
    completarEmail('ana@example.com');
    enviar();
    backend.expectOne((r) => r.url.endsWith('/auth/forgot-password')).flush(null, { status: 500, statusText: 'Error' });
    fixture.detectChanges();

    expect(page.recoveryModel().email).toBe('ana@example.com');
  });

  it('tiene un enlace para volver al login', () => {
    expect(html.querySelector('a[href="/login"]')).not.toBeNull();
  });
});
