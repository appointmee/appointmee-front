import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, convertToParamMap, provideRouter } from '@angular/router';
import { Component } from '@angular/core';
import { verificacionPendienteService } from '../services/verificacion-pendiente-service';
import { authService } from '../services/auth-service';
import { guestGuard } from './guest-guard';

@Component({ template: '' })
class TestPage {}

describe('guestGuard del login', () => {
  const auth = { autenticado: vi.fn() };
  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.configureTestingModule({ providers: [
      provideRouter([{ path: 'login', component: TestPage }, { path: 'sucursales', component: TestPage }, { path: 'perfil', component: TestPage }]),
      { provide: authService, useValue: auth },
    ] });
  });
  function ejecutar(returnTo?: string) {
    return TestBed.runInInjectionContext(() => guestGuard(
      { queryParamMap: convertToParamMap(returnTo ? { returnTo } : {}) } as ActivatedRouteSnapshot,
      {} as RouterStateSnapshot,
    ));
  }
  it('el visitante accede sin requerir autenticación', () => {
    auth.autenticado.mockReturnValue(false); expect(ejecutar()).toBe(true);
  });
  it('con sesión activa redirige antes de mostrar el formulario', () => {
    auth.autenticado.mockReturnValue(true);
    expect((ejecutar('/perfil?tab=cuenta') as UrlTree).toString()).toBe('/perfil?tab=cuenta');
  });
  it.each([undefined, 'https://example.com', '//example.com', '/login', '/inexistente', '/\\example.com'])('returnTo %s cae en sucursales', returnTo => {
    auth.autenticado.mockReturnValue(true);
    expect((ejecutar(returnTo) as UrlTree).toString()).toBe('/sucursales');
  });

  it('volver al login limpia el email pendiente', () => {
    const pending = TestBed.inject(verificacionPendienteService);
    pending.guardarEmail('ana@example.com', 'ticket-prueba');
    auth.autenticado.mockReturnValue(false);
    ejecutar(); expect(pending.leer()).toBeNull();
  });
});
