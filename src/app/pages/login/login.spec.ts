import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { Subject, of } from 'rxjs';
import { LoginPage } from './login';
import { authService } from '../../services/auth-service';

describe('Login con Signal Forms', () => {
  let fixture: ComponentFixture<LoginPage>;
  let page: LoginPage;
  const auth = { login: vi.fn() };

  beforeEach(async () => {
    vi.resetAllMocks();
    // JSDOM does not implement native dialog methods; browser supplies focus trapping.
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value: function(this: HTMLDialogElement) { this.setAttribute('open', ''); },
    });
    await TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [
        provideRouter([{ path: 'sucursales', component: LoginPage }, { path: 'perfil', component: LoginPage }]),
        { provide: authService, useValue: auth },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({ returnTo: '/perfil' }) } } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginPage);
    page = fixture.componentInstance;
    fixture.detectChanges();
  });

  function completar() {
    page.loginModel.set({ email: 'ana@example.com', password: 'clave sin complejidad' });
    fixture.detectChanges();
  }

  function enviar() {
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();
  }

  it('valida campos vacíos y email sin exigir complejidad de contraseña', () => {
    enviar(); expect(auth.login).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Ingresá tu email.');
    page.loginModel.set({ email: 'invalido', password: 'x' });
    fixture.detectChanges(); enviar(); expect(auth.login).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Ingresá un email válido.');
    expect(page.loginForm.password().valid()).toBe(true);
  });

  it('bloquea envíos duplicados y muestra carga', () => {
    const response = new Subject<void>(); auth.login.mockReturnValue(response);
    completar(); enviar(); enviar();
    expect(auth.login).toHaveBeenCalledTimes(1);
    const button = fixture.nativeElement.querySelector('.login__submit') as HTMLButtonElement;
    expect(button.disabled).toBe(true); expect(button.textContent).toContain('Ingresando');
  });

  it('ante 401 conserva email, borra contraseña y la enfoca', () => {
    const response = new Subject<void>(); auth.login.mockReturnValue(response);
    completar(); enviar(); response.error({ status: 401 }); fixture.detectChanges();
    expect(page.loginModel()).toEqual({ email: 'ana@example.com', password: '' });
    expect(fixture.nativeElement.textContent).toContain('Email o contraseña incorrectos');
    expect(document.activeElement?.id).toBe('login-password');
    expect(page.cargando()).toBe(false);
  });

  it('permite mostrar y ocultar contraseña con un botón accesible', () => {
    const toggle = fixture.nativeElement.querySelector('.login__toggle') as HTMLButtonElement;
    const input = fixture.nativeElement.querySelector('#login-password') as HTMLInputElement;
    expect(input.type).toBe('password'); toggle.click(); fixture.detectChanges();
    expect(input.type).toBe('text'); expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(toggle.getAttribute('aria-label')).toBe('Ocultar contraseña');
    toggle.click(); fixture.detectChanges(); expect(input.type).toBe('password');
    expect(toggle.type).toBe('button'); expect(auth.login).not.toHaveBeenCalled();
  });

  it('muestra el caso sin verificar y precarga el email del enlace', () => {
    const response = new Subject<void>(); auth.login.mockReturnValue(response);
    completar(); enviar(); response.error({ status: 403, code: 'EMAIL_NOT_VERIFIED' }); fixture.detectChanges();
    const link = fixture.nativeElement.querySelector('.login__link') as HTMLAnchorElement;
    expect(new URL(link.href).searchParams.get('email')).toBe('ana@example.com');
    expect(new URL(link.href).pathname).toBe('/configuracion/verificar-email');
    expect(fixture.nativeElement.querySelector('app-cuenta-sin-verificar-modal')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Tu cuenta todavía no está verificada');
  });

  it('aceptar el modal abre configuración de verificación con el email', () => {
    const response = new Subject<void>(); auth.login.mockReturnValue(response);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    completar(); enviar(); response.error({ status: 403, code: 'EMAIL_NOT_VERIFIED' }); fixture.detectChanges();
    fixture.nativeElement.querySelector('.verificacion-modal__aceptar').click(); fixture.detectChanges();
    expect(navigate).toHaveBeenCalledWith(['/configuracion/verificar-email'], { queryParams: { email: 'ana@example.com' } });
    expect(page.modalVerificacion()).toBe(false);
  });

  it('cancelar o Escape cierran el modal sin navegar', () => {
    const response = new Subject<void>(); auth.login.mockReturnValue(response);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');
    completar(); enviar(); response.error({ status: 403, code: 'EMAIL_NOT_VERIFIED' }); fixture.detectChanges();
    fixture.nativeElement.querySelector('.verificacion-modal__cancelar').click(); fixture.detectChanges();
    expect(page.modalVerificacion()).toBe(false);
    page.modalVerificacion.set(true); fixture.detectChanges();
    fixture.nativeElement.querySelector('dialog').dispatchEvent(new Event('cancel')); fixture.detectChanges();
    expect(page.modalVerificacion()).toBe(false); expect(navigate).not.toHaveBeenCalled();
  });

  it('muestra espera cuando recibe 429', () => {
    const response = new Subject<void>(); auth.login.mockReturnValue(response);
    completar(); enviar(); response.error({ status: 429, retryAfterSeconds: 60 }); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Esperá 60 segundos');
  });

  it.each([0, 500, 503])('error %s queda inline y permite reintentar', status => {
    const response = new Subject<void>(); auth.login.mockReturnValue(response);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');
    completar(); enviar(); response.error({ status }); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.login__retry')).not.toBeNull();
    expect(navigate).not.toHaveBeenCalled();
    auth.login.mockReturnValue(new Subject<void>());
    fixture.nativeElement.querySelector('.login__retry').click(); fixture.detectChanges();
    expect(auth.login).toHaveBeenCalledTimes(2);
  });

  it('login exitoso vuelve a returnTo y tiene enlaces de cuenta y recuperación', () => {
    auth.login.mockReturnValue(of(undefined));
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    completar(); enviar();
    expect(navigate.mock.calls[0][0].toString()).toBe('/perfil');
    expect(fixture.nativeElement.querySelector('a[href="/registrarme"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.login__forgot').getAttribute('href')).toContain('/olvide-mi-contrasena');
    expect(fixture.nativeElement.querySelector('.login__feedback').getAttribute('aria-live')).toBe('polite');
  });
});
