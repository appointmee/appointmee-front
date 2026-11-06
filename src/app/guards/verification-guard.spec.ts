import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { firstValueFrom, isObservable, of, throwError } from 'rxjs';
import { verificationGuard } from './verification-guard';
import { authService } from '../services/auth-service';
import { verificacionPendienteService } from '../services/verificacion-pendiente-service';

const estado = { verificada: false, enviado: true, enviadoAhora: false, retryAfterSeconds: 42, attemptsRemaining: 4, expiresInSeconds: 250 };

describe('verificationGuard', () => {
  const auth = { autenticado: vi.fn(), estadoVerificacion: vi.fn(), completarVerificacion: vi.fn() };
  beforeEach(() => {
    sessionStorage.clear(); vi.resetAllMocks();
    auth.autenticado.mockReturnValue(false);
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: authService, useValue: auth }] });
  });
  async function ejecutar() {
    const resultado = TestBed.runInInjectionContext(() => verificationGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot));
    return isObservable(resultado) ? firstValueFrom(resultado) : await resultado;
  }
  it('sin pasar por login no permite abrir la URL', async () => {
    expect((await ejecutar() as UrlTree).toString()).toBe('/login');
    expect(auth.estadoVerificacion).not.toHaveBeenCalled();
  });
  it('escribir solo un email en sessionStorage no autoriza', async () => {
    sessionStorage.setItem('verificacionPendiente', JSON.stringify({ email: 'ana@example.com', intentos: 0, reenviarDesde: 0 }));
    expect((await ejecutar() as UrlTree).toString()).toBe('/login');
  });
  it('confirma con backend la autorización obtenida del login', async () => {
    TestBed.inject(verificacionPendienteService).guardarEmail('ana@example.com', 'ticket');
    auth.estadoVerificacion.mockReturnValue(of(estado)); expect(await ejecutar()).toBe(true);
  });
  it('un ticket manipulado o vencido es rechazado', async () => {
    const pendiente = TestBed.inject(verificacionPendienteService); pendiente.guardarEmail('ana@example.com', 'ticket-falso');
    auth.estadoVerificacion.mockReturnValue(throwError(() => ({ status: 401 })));
    expect((await ejecutar() as UrlTree).toString()).toBe('/login'); expect(pendiente.leer()).toBeNull();
  });
  it('si la confirmación anterior llegó al servidor, completa la sesión sin pedir otro código', async () => {
    const pendiente = TestBed.inject(verificacionPendienteService); pendiente.guardarEmail('ana@example.com', 'ticket');
    auth.estadoVerificacion.mockReturnValue(of({ ...estado, verificada: true }));
    auth.completarVerificacion.mockReturnValue(of({}));
    expect((await ejecutar() as UrlTree).toString()).toBe('/sucursales');
    expect(auth.completarVerificacion).toHaveBeenCalledTimes(1); expect(pendiente.leer()).toBeNull();
  });
});
