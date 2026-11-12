import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterOutlet,
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
    autenticado: vi.fn(),
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
  it('sin credenciales redirige al Home público', async () => {
    const result = (await ejecutar()) as UrlTree;
    expect(result.toString()).toBe('/');
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
    expect(((await ejecutar(['ADMINISTRADOR'])) as UrlTree).toString()).toBe('/');
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
    expect(((await ejecutar(undefined, ['ADMINISTRADOR'])) as UrlTree).toString()).toBe('/');
  });
  it('permite el acceso cuando no tiene el rol excluido', async () => {
    auth.getAccessToken.mockReturnValue('access');
    auth.validarToken.mockReturnValue(of({}));
    auth.tieneAlgunRol.mockReturnValue(false);
    expect(await ejecutar(undefined, ['ADMINISTRADOR'])).toBe(true);
  });
  it('entiende el 401 normalizado por el interceptor de errores', async () => {
    auth.getAccessToken.mockReturnValue('access');
    auth.validarToken.mockReturnValue(
      throwError(() => ({ status: 401, message: 'Sesión vencida' })),
    );
    expect(((await ejecutar()) as UrlTree).toString()).toBe('/');
    expect(auth.limpiarSesion).toHaveBeenCalled();
  });
  it('no deja pasar una sesión desconocida ante un fallo de red', async () => {
    auth.getRefreshToken.mockReturnValue('refresh');
    auth.validarToken.mockReturnValue(throwError(() => ({ status: 0 })));
    expect(((await ejecutar()) as UrlTree).toString()).toBe('/');
    expect(auth.limpiarSesion).not.toHaveBeenCalled();
  });

  it('mantiene acceso offline solo para una sesión previamente validada y autorizada', async () => {
    auth.getAccessToken.mockReturnValue('access');
    auth.autenticado.mockReturnValue(true);
    auth.tieneAlgunRol.mockReturnValue(true);
    vi.stubGlobal('navigator', { ...navigator, onLine: false });
    try {
      expect(await ejecutar(['EMPLEADOR'])).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

@Component({ standalone: true, imports: [RouterOutlet], template: '<router-outlet />' })
class GuardTestHost {}

@Component({ standalone: true, template: '<p>Inicio público</p>' })
class GuardTestHome {}

@Component({ standalone: true, template: '<p>Contenido protegido</p>' })
class GuardTestProtected {}

@Component({ standalone: true, template: '<p>Página pública</p>' })
class GuardTestPublic {}

describe('authGuard con navegación Angular', () => {
  const auth = {
    getAccessToken: vi.fn(),
    getRefreshToken: vi.fn(),
    validarToken: vi.fn(),
    tieneAlgunRol: vi.fn(),
    limpiarSesion: vi.fn(),
    autenticado: vi.fn(),
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    auth.getAccessToken.mockReturnValue(null);
    auth.getRefreshToken.mockReturnValue(null);
    await TestBed.configureTestingModule({
      imports: [GuardTestHost],
      providers: [
        provideRouter([
          { path: '', component: GuardTestHome },
          {
            path: 'protegida',
            component: GuardTestProtected,
            canActivate: [authGuard],
            data: { roles: ['EMPLEADOR'] },
          },
          { path: 'publica', component: GuardTestPublic },
        ]),
        { provide: authService, useValue: auth },
      ],
    }).compileComponents();
  });

  it('bloquea el acceso directo a una URL protegida para visitantes y vuelve al Home', async () => {
    const fixture = TestBed.createComponent(GuardTestHost);
    const router = TestBed.inject(Router);

    await router.navigateByUrl('/protegida');
    fixture.detectChanges();

    expect(router.url).toBe('/');
    expect(fixture.nativeElement.textContent).toContain('Inicio público');
    expect(fixture.nativeElement.textContent).not.toContain('Contenido protegido');
    expect(auth.validarToken).not.toHaveBeenCalled();
  });

  it('bloquea desde otra pantalla a una sesión autenticada sin el rol requerido', async () => {
    auth.getAccessToken.mockReturnValue('access');
    auth.validarToken.mockReturnValue(of({}));
    auth.tieneAlgunRol.mockReturnValue(false);
    const fixture = TestBed.createComponent(GuardTestHost);
    const router = TestBed.inject(Router);

    await router.navigateByUrl('/publica');
    await router.navigateByUrl('/protegida');
    fixture.detectChanges();

    expect(router.url).toBe('/');
    expect(fixture.nativeElement.textContent).toContain('Inicio público');
    expect(fixture.nativeElement.textContent).not.toContain('Contenido protegido');
  });

  it('mantiene accesibles las rutas públicas para una persona anónima', async () => {
    const fixture = TestBed.createComponent(GuardTestHost);
    const router = TestBed.inject(Router);

    await router.navigateByUrl('/publica');
    fixture.detectChanges();

    expect(router.url).toBe('/publica');
    expect(fixture.nativeElement.textContent).toContain('Página pública');
    expect(auth.validarToken).not.toHaveBeenCalled();
  });

  it('permite la ruta pública y muestra la protegida a un usuario autorizado', async () => {
    auth.getAccessToken.mockReturnValue('access');
    auth.validarToken.mockReturnValue(of({}));
    auth.tieneAlgunRol.mockReturnValue(true);
    const fixture = TestBed.createComponent(GuardTestHost);
    const router = TestBed.inject(Router);

    await router.navigateByUrl('/publica');
    fixture.detectChanges();
    expect(router.url).toBe('/publica');
    expect(fixture.nativeElement.textContent).toContain('Página pública');

    await router.navigateByUrl('/protegida');
    fixture.detectChanges();
    expect(router.url).toBe('/protegida');
    expect(fixture.nativeElement.textContent).toContain('Contenido protegido');
  });
});
