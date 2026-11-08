import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { CambiarPassword } from './cambiar-password';
import { authService } from '../../services/auth-service';
import { HttpErrorResponse } from '@angular/common/http';

describe('Cambiar contraseña en Ajustes', () => {
  let respuesta: Subject<{ message: string }>;
  const auth = { cambiarPassword: vi.fn(), limpiarSesion: vi.fn(), logout: vi.fn() };
  beforeEach(() => {
    TestBed.resetTestingModule();
    vi.resetAllMocks();
    respuesta = new Subject();
    auth.cambiarPassword.mockReturnValue(respuesta);
    auth.logout.mockReturnValue(of(undefined));
    TestBed.configureTestingModule({
      imports: [CambiarPassword], providers: [provideRouter([]), { provide: authService, useValue: auth }],
    });
  });
  afterEach(() => TestBed.resetTestingModule());
  function crear() {
    const fixture = TestBed.createComponent(CambiarPassword);
    fixture.detectChanges();
    return fixture;
  }
  it('valida contraseña actual, política y confirmación antes de enviar', () => {
    const fixture = crear();
    const panel = fixture.componentInstance;
    panel.onSubmit(new Event('submit'));
    expect(auth.cambiarPassword).not.toHaveBeenCalled();
    panel.passwordModel.set({ actual: 'Actual123!', nueva: 'simple', confirmar: 'simple' });
    fixture.detectChanges(); panel.onSubmit(new Event('submit'));
    expect(auth.cambiarPassword).not.toHaveBeenCalled();
    panel.passwordModel.set({ actual: 'Actual123!', nueva: 'NuevaClave123!', confirmar: 'OtraClave123!' });
    fixture.detectChanges(); panel.onSubmit(new Event('submit'));
    expect(auth.cambiarPassword).not.toHaveBeenCalled();
    expect(panel.requisitos().every(requisito => requisito.cumplido)).toBe(true);
  });
  it('bloquea envíos duplicados, borra campos y vuelve al login al guardar', () => {
    const fixture = crear();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const panel = fixture.componentInstance;
    panel.passwordModel.set({ actual: 'Actual123!', nueva: 'NuevaClave123!', confirmar: 'NuevaClave123!' });
    fixture.detectChanges();
    panel.onSubmit(new Event('submit')); panel.onSubmit(new Event('submit'));
    expect(auth.cambiarPassword).toHaveBeenCalledExactlyOnceWith('Actual123!', 'NuevaClave123!');
    respuesta.next({ message: 'Actualizada' });
    expect(auth.limpiarSesion).toHaveBeenCalled();
    expect(panel.passwordModel()).toEqual({ actual: '', nueva: '', confirmar: '' });
    expect(navigate).toHaveBeenCalledWith(['/login'], { replaceUrl: true, state: { passwordActualizada: true, passwordDesdeAjustes: true } });
  });
  it.each([
    ['CURRENT_PASSWORD_INVALID', 400, 'La contraseña actual es incorrecta.'],
    ['NETWORK_ERROR', 0, 'No pudimos confirmar el cambio.'],
    ['HTTP_503', 503, 'No pudimos confirmar el cambio.'],
  ])('muestra el error %s inline y conserva la sesión', (code, status, mensaje) => {
    const fixture = crear();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');
    const panel = fixture.componentInstance;
    panel.passwordModel.set({ actual: 'Actual123!', nueva: 'NuevaClave123!', confirmar: 'NuevaClave123!' });
    fixture.detectChanges(); panel.onSubmit(new Event('submit'));
    respuesta.error({ code, status }); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(mensaje);
    expect(auth.limpiarSesion).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(panel.passwordModel()).toEqual({ actual: '', nueva: '', confirmar: '' });
    expect(document.activeElement?.id).toBe('cambio-actual');
  });
  it('ofrece cerrar sesión sin exigir completar el formulario', () => {
    const fixture = crear();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
    buttons.find(button => button.textContent?.includes('No recuerdo'))!.click(); fixture.detectChanges();
    expect(auth.logout).not.toHaveBeenCalled();
    fixture.componentInstance.cerrarParaRecuperar();
    expect(auth.logout).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith(['/olvide-mi-contrasena'], { replaceUrl: true });
  });

  it('explica el 401 de contraseña incorrecta del backend anterior sin cerrar sesión', () => {
    const fixture = crear();
    const panel = fixture.componentInstance;
    panel.passwordModel.set({ actual: 'Incorrecta123!', nueva: 'NuevaClave123!', confirmar: 'NuevaClave123!' });
    fixture.detectChanges(); panel.onSubmit(new Event('submit'));
    respuesta.error(new HttpErrorResponse({ status: 401, error: 'Contraseña actual incorrecta' }));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('La contraseña actual es incorrecta.');
    expect(auth.limpiarSesion).not.toHaveBeenCalled();
  });
  it('permite salir localmente aunque falle el endpoint de logout', () => {
    auth.logout.mockReturnValue(throwError(() => ({ status: 0 })));
    const fixture = crear();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture.componentInstance.cerrarParaRecuperar();
    expect(auth.limpiarSesion).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/olvide-mi-contrasena'], { replaceUrl: true });
  });
});
