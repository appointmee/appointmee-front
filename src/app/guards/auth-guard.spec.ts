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
    expirado: vi.fn(),
  };
  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: authService, useValue: auth }],
    });
  });
  async function ejecutar(roles?: string[], rolesExcluidos?: string[]) {
    const result = TestBed.runInInjectionContext(() =>
      authGuard(
        { data: { roles, rolesExcluidos } } as unknown as ActivatedRouteSnapshot,
        { url: '/admin' } as RouterStateSnapshot,
      ),
    );
    return isObservable(result) ? firstValueFrom(result) : await result;
  }
  it('sin credenciales redirige a la pantalla de error 401', async () => {
    const result = (await ejecutar()) as UrlTree;
    expect(result.toString()).toBe('/error?status=401');
    expect(auth.validarToken).not.toHaveBeenCalled();
  });
  it('sin credenciales redirige a la pantalla de error 401 aunque la sesión expiró', async () => {
    auth.expirado.mockReturnValue(true);
    expect(((await ejecutar()) as UrlTree).toString()).toBe('/error?status=401');
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
  it('rechaza el acceso cuando el usuario tiene un rol excluido', async () => {
    auth.getAccessToken.mockReturnValue('access');
    auth.validarToken.mockReturnValue(of({}));
    auth.tieneAlgunRol.mockReturnValue(true);
    expect(((await ejecutar(undefined, ['ADMINISTRADOR'])) as UrlTree).toString()).toBe(
      '/error?status=403',
    );
  });
  it('permite el acceso cuando no tiene el rol excluido', async () => {
    auth.getAccessToken.mockReturnValue('access');
    auth.validarToken.mockReturnValue(of({}));
    auth.tieneAlgunRol.mockReturnValue(false);
    expect(await ejecutar(undefined, ['ADMINISTRADOR'])).toBe(true);
  });
  it('entierra el 401 de la sesión en la pantalla de error', async () => {
    auth.getAccessToken.mockReturnValue('access');
    auth.validarToken.mockReturnValue(
      throwError(() => ({ status: 401, message: 'Sesión vencida' })),
    );
    expect(((await ejecutar()) as UrlTree).toString()).toBe('/error?status=401');
    expect(auth.limpiarSesion).toHaveBeenCalled();
  });
  it('deja pasar y conserva credenciales ante un fallo de red', async () => {
    auth.getRefreshToken.mockReturnValue('refresh');
    auth.validarToken.mockReturnValue(throwError(() => ({ status: 0 })));
    expect(await ejecutar()).toBe(true);
    expect(auth.limpiarSesion).not.toHaveBeenCalled();
  });
});
