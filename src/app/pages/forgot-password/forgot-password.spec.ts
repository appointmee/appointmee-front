import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Subject, throwError } from 'rxjs';

import { authService } from '../../services/auth-service';
import { ForgotPasswordPage } from './forgot-password';

describe('Solicitar recuperación de contraseña', () => {
  let fixture: ComponentFixture<ForgotPasswordPage>;
  let page: ForgotPasswordPage;
  const auth = { solicitarRecuperacion: vi.fn(), guardarEmailRecuperacion: vi.fn() };

  beforeEach(async () => {
    vi.resetAllMocks();
    await TestBed.configureTestingModule({
      imports: [ForgotPasswordPage],
      providers: [provideRouter([]), { provide: authService, useValue: auth }],
    }).compileComponents();
    fixture = TestBed.createComponent(ForgotPasswordPage);
    page = fixture.componentInstance;
    fixture.detectChanges();
  });
  afterEach(() => TestBed.resetTestingModule());

  it('rechaza email vacío o inválido sin llamar al backend', () => {
    page.onSubmit(new Event('submit', { cancelable: true }));
    expect(auth.solicitarRecuperacion).not.toHaveBeenCalled();
    page.recoveryModel.set({ email: 'no-es-email' });
    page.onSubmit(new Event('submit', { cancelable: true }));
    expect(auth.solicitarRecuperacion).not.toHaveBeenCalled();
  });

  it('muestra mensaje genérico, guarda email en memoria y navega sin incluirlo en URL', () => {
    const solicitud = new Subject<{ message: string }>();
    auth.solicitarRecuperacion.mockReturnValue(solicitud);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    page.recoveryModel.set({ email: 'persona@example.com' });
    page.onSubmit(new Event('submit', { cancelable: true }));
    solicitud.next({ message: 'ignored' });
    expect(page.mensaje()).toBe('Si el email está registrado, te enviamos un código de 6 dígitos. Revisá también spam');
    expect(auth.guardarEmailRecuperacion).toHaveBeenCalledWith('persona@example.com');
    expect(navigate).toHaveBeenCalledWith(['/reset-password'], { state: { mensajeRecuperacion: page.mensaje() } });
  });

  it('muestra 429 inline y permite reintentar con el email conservado', () => {
    auth.solicitarRecuperacion.mockReturnValueOnce(throwError(() => ({ status: 429 })));
    page.recoveryModel.set({ email: 'persona@example.com' });
    page.onSubmit(new Event('submit', { cancelable: true }));
    expect(page.error()).toBe(true);
    expect(page.mensaje()).toContain('Demasiadas solicitudes');
    expect(page.recoveryModel().email).toBe('persona@example.com');
  });

  it('muestra error de red inline y conserva email para reintentar', () => {
    auth.solicitarRecuperacion.mockReturnValueOnce(throwError(() => ({ status: 0 })));
    page.recoveryModel.set({ email: 'persona@example.com' });
    page.onSubmit(new Event('submit', { cancelable: true }));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
    expect(page.recoveryModel().email).toBe('persona@example.com');
  });
});
