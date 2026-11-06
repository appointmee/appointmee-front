import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { ResetPasswordPage } from './reset-password';
import { authService } from '../../services/auth-service';
import { MensajeResponse } from '../../models/auth';

describe('Restablecer contraseña', () => {
  let fixture: ComponentFixture<ResetPasswordPage>;
  let page: ResetPasswordPage;
  let respuesta: Subject<MensajeResponse>;
  const auth = { restablecerPassword: vi.fn() };
  const token = 'token-de-prueba-para-restablecer';

  beforeEach(async () => {
    vi.resetAllMocks();
    respuesta = new Subject<MensajeResponse>();
    auth.restablecerPassword.mockReturnValue(respuesta);
    await TestBed.configureTestingModule({
      imports: [ResetPasswordPage],
      providers: [
        provideRouter([]),
        { provide: authService, useValue: auth },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({ token }) } } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ResetPasswordPage);
    page = fixture.componentInstance;
    fixture.detectChanges();
  });

  function enviar() {
    page.onSubmit(new Event('submit', { cancelable: true }));
    fixture.detectChanges();
  }

  function completar() {
    page.passwordModel.set({ password: 'NuevaClave123!', confirmarPassword: 'NuevaClave123!' });
    fixture.detectChanges();
  }

  it('valida complejidad y coincidencia sin enviar datos inválidos', () => {
    page.passwordModel.set({ password: 'simple', confirmarPassword: 'simple' }); enviar();
    expect(auth.restablecerPassword).not.toHaveBeenCalled();
    completar();
    page.passwordModel.update(datos => ({ ...datos, confirmarPassword: 'OtraClave123!' })); enviar();
    expect(auth.restablecerPassword).not.toHaveBeenCalled();
  });

  it('envía el token y la nueva contraseña una sola vez y muestra éxito', () => {
    completar(); enviar(); enviar();
    expect(auth.restablecerPassword).toHaveBeenCalledExactlyOnceWith(token, 'NuevaClave123!');
    respuesta.next({ message: 'Contraseña restablecida' }); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Contraseña restablecida');
    expect(fixture.nativeElement.querySelector('a[href="/login"]')).not.toBeNull();
    expect(page.passwordModel()).toEqual({ password: '', confirmarPassword: '' });
    expect(fixture.nativeElement.textContent).not.toContain(token);
  });

  it('ofrece un nuevo enlace si el token venció o ya fue utilizado', () => {
    completar(); enviar(); respuesta.error({ status: 400 }); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('El enlace no es válido o venció');
    expect(fixture.nativeElement.querySelector('a[href="/olvide-mi-contrasena"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
  });

  it.each([0, 503])('limpia las contraseñas y permite reintentar tras error %s', status => {
    completar(); enviar(); respuesta.error({ status }); fixture.detectChanges();
    expect(page.passwordModel()).toEqual({ password: '', confirmarPassword: '' });
    expect(page.enlaceInvalido()).toBe(false);
    expect(fixture.nativeElement.querySelector('[type="submit"]').textContent).toContain('Reintentar');
    auth.restablecerPassword.mockReturnValue(new Subject<MensajeResponse>());
    completar(); enviar();
    expect(auth.restablecerPassword).toHaveBeenCalledTimes(2);
  });

  it('no muestra el formulario si falta el token', () => {
    fixture.destroy();
    const route = TestBed.inject(ActivatedRoute);
    Object.defineProperty(route.snapshot, 'queryParamMap', { value: convertToParamMap({}), configurable: true });
    fixture = TestBed.createComponent(ResetPasswordPage);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
    expect(auth.restablecerPassword).not.toHaveBeenCalled();
  });
});
