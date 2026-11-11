import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { Subject, throwError } from 'rxjs';

import { MensajeResponse } from '../../models/auth';
import { authService } from '../../services/auth-service';
import { ResetPasswordPage } from './reset-password';

describe('Restablecer contraseña con código', () => {
  let fixture: ComponentFixture<ResetPasswordPage>;
  let page: ResetPasswordPage;
  let emailState: ReturnType<typeof signal<string | null>>;
  const respuesta = new Subject<MensajeResponse>();
  const auth = { emailRecuperacionPendiente: vi.fn(), restablecerPassword: vi.fn() };

  beforeEach(async () => {
    TestBed.resetTestingModule();
    vi.resetAllMocks();
    emailState = signal<string | null>('persona@example.com');
    auth.emailRecuperacionPendiente.mockImplementation(() => emailState());
    auth.restablecerPassword.mockReturnValue(respuesta);
    await TestBed.configureTestingModule({
      imports: [ResetPasswordPage],
      providers: [provideRouter([]), { provide: authService, useValue: auth }],
    }).compileComponents();
    fixture = TestBed.createComponent(ResetPasswordPage);
    page = fixture.componentInstance;
    fixture.detectChanges();
  });
  afterEach(() => TestBed.resetTestingModule());

  function completar() {
    page.modelo.set({ code: '012345', password: 'NuevaClave123!', confirmarPassword: 'NuevaClave123!' });
    fixture.detectChanges();
  }

  it('mantiene el email fuera de la URL y presenta campos de código y contraseña', () => {
    expect(fixture.nativeElement.querySelector('#reset-code')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('#reset-password')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('persona@example.com');
    expect(location.search).toBe('');
  });

  it('valida código de seis dígitos, complejidad y coincidencia antes de enviar', () => {
    page.modelo.set({ code: '12', password: 'simple', confirmarPassword: 'simple' });
    page.onSubmit(new Event('submit', { cancelable: true }));
    expect(auth.restablecerPassword).not.toHaveBeenCalled();
    page.modelo.set({ code: '012345', password: 'NuevaClave123!', confirmarPassword: 'OtraClave123!' });
    page.onSubmit(new Event('submit', { cancelable: true }));
    expect(auth.restablecerPassword).not.toHaveBeenCalled();
  });

  it('envía email, código y contraseña una sola vez; limpia contraseñas al completar', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    completar();
    page.onSubmit(new Event('submit', { cancelable: true }));
    page.onSubmit(new Event('submit', { cancelable: true }));
    expect(auth.restablecerPassword).toHaveBeenCalledExactlyOnceWith('persona@example.com', '012345', 'NuevaClave123!');
    respuesta.next({ message: 'Contraseña restablecida' });
    fixture.detectChanges();
    expect(page.modelo()).toEqual({ code: '', password: '', confirmarPassword: '' });
    expect(navigate).toHaveBeenCalledWith(['/login'], { replaceUrl: true, state: { passwordActualizada: true } });
  });

  it('muestra el límite de intentos como error inline', () => {
    auth.restablecerPassword.mockReturnValueOnce(throwError(() => ({ status: 429 })));
    completar();
    page.onSubmit(new Event('submit', { cancelable: true }));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Demasiados intentos');
  });

  it('no ofrece el formulario si se abre sin el estado del email', () => {
    fixture.destroy();
    emailState.set(null);
    fixture = TestBed.createComponent(ResetPasswordPage);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
    expect(fixture.nativeElement.querySelector('a[href="/recuperar-password"]')).not.toBeNull();
    expect(auth.restablecerPassword).not.toHaveBeenCalled();
  });
});
