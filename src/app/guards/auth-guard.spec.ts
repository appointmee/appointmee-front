import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { firstValueFrom, isObservable, of, throwError } from 'rxjs';
import { authService } from '../services/auth-service';
import { authGuard } from './auth-guard';

describe('authGuard', () => {
  const auth = {
    getAccessToken: vi.fn(),
    getRefreshToken: vi.fn(),
    validarToken: vi.fn(),
    tieneAlgunRol: vi.fn(),
    limpiarSesion: vi.fn(),
  };
  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: authService, useValue: auth }],
    });
  });
  async function ejecutar(roles?: string[]) {
    const result = TestBed.runInInjectionContext(() =>
      authGuard(
        { data: { roles } } as unknown as ActivatedRouteSnapshot,
        { url: '/admin' } as RouterStateSnapshot,
      ),
    );
    return isObservable(result) ? firstValueFrom(result) : await result;
  }
  it('sin credenciales redirige a login y conserva el destino', async () => {
    const result = (await ejecutar()) as UrlTree;
    expect(result.toString()).toBe('/login?returnTo=%2Fadmin');
    expect(auth.validarToken).not.toHaveBeenCalled();
  });
  it('valida en backend antes de permitir acceso', async () => {
    auth.getAccessToken.mockReturnValue('access');
    auth.validarToken.mockReturnValue(of({}));
    expect(await ejecutar()).toBe(true);
  });
  it('rechaza el rol incorrecto', async () => {
    auth.getAccessToken.mockReturnValue('access');
    auth.validarToken.mockReturnValue(of({}));
    auth.tieneAlgunRol.mockReturnValue(false);
    expect(((await ejecutar(['ADMINISTRADOR'])) as UrlTree).toString()).toBe('/error?status=403');
  });
  it('acepta el rol indicado', async () => {
    auth.getAccessToken.mockReturnValue('access');
    auth.validarToken.mockReturnValue(of({}));
    auth.tieneAlgunRol.mockReturnValue(true);
    expect(await ejecutar(['ADMINISTRADOR'])).toBe(true);
  });
  it('entiende el 401 normalizado por el interceptor de errores', async () => {
    auth.getAccessToken.mockReturnValue('access');
    auth.validarToken.mockReturnValue(
      throwError(() => ({ status: 401, message: 'Sesión vencida' })),
    );
    expect(((await ejecutar()) as UrlTree).toString()).toBe('/login?returnTo=%2Fadmin');
    expect(auth.limpiarSesion).toHaveBeenCalled();
  });
  it('no borra credenciales por un fallo de red', async () => {
    auth.getRefreshToken.mockReturnValue('refresh');
    auth.validarToken.mockReturnValue(throwError(() => ({ status: 0 })));
    expect(((await ejecutar()) as UrlTree).toString()).toBe('/error?status=0');
    expect(auth.limpiarSesion).not.toHaveBeenCalled();
  });
});
