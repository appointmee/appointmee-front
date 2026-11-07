import { Component, signal } from '@angular/core';
import { FormControl } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Navbar } from './navbar';
import { authService } from '../../services/auth-service';
import { BranchSearch } from '../../services/branch-search';

@Component({ selector: 'app-navbar-test-page', template: '' })
class EmptyPage {}

describe('Buscador del navbar', () => {
  beforeEach(() => TestBed.resetTestingModule());
  it('mantiene el navbar sin buscador en Home y en Sucursales', async () => {
    TestBed.configureTestingModule({
      imports: [Navbar],
      providers: [
        provideRouter([
          { path: '', component: EmptyPage },
          { path: 'sucursales', component: EmptyPage },
        ]),
        { provide: authService, useValue: {
          autenticado: signal(false), visitante: signal(true), restaurando: signal(false),
        } },
        { provide: BranchSearch, useValue: { search: new FormControl(''), term: signal('') } },
      ],
    });
    const router = TestBed.inject(Router);
    const fixture = TestBed.createComponent(Navbar);
    await router.navigateByUrl('/'); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#navbar-search')).toBeNull();
    await router.navigateByUrl('/sucursales?busqueda=pelu'); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#navbar-search')).toBeNull();
    expect(fixture.nativeElement.querySelector('.search-trigger')).toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.navbar__search-wrap')).toBeNull();
    await router.navigateByUrl('/'); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#navbar-search')).toBeNull();
  });
});

describe('Navbar en la vista de error', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('muestra una versión mínima con acceso a login para visitantes', async () => {
    TestBed.configureTestingModule({
      imports: [Navbar],
      providers: [
        provideRouter([{ path: 'error', component: EmptyPage }]),
        { provide: authService, useValue: {
          autenticado: signal(false), visitante: signal(true), restaurando: signal(false),
        } },
      ],
    });
    const router = TestBed.inject(Router);
    const fixture = TestBed.createComponent(Navbar);
    await router.navigateByUrl('/error');
    fixture.detectChanges();

    const html = fixture.nativeElement as HTMLElement;
    expect(html.querySelector('.nav')).toBeNull();
    expect(html.querySelector('.burger')).toBeNull();
    expect(html.querySelector('a[href="/login"]')?.textContent).toContain('Iniciar sesión');
    expect(html.querySelector('a[href="/registrarme"]')).toBeNull();
  });

  it('conserva la navegación completa para usuarios con sesión', async () => {
    TestBed.configureTestingModule({
      imports: [Navbar],
      providers: [
        provideRouter([{ path: 'error', component: EmptyPage }]),
        { provide: authService, useValue: {
          autenticado: signal(true), visitante: signal(false), restaurando: signal(false),
          perfil: signal(null), iniciales: signal('AM'), tieneAlgunRol: () => false,
        } },
      ],
    });
    const router = TestBed.inject(Router);
    const fixture = TestBed.createComponent(Navbar);
    await router.navigateByUrl('/error');
    fixture.detectChanges();

    const html = fixture.nativeElement as HTMLElement;
    expect(html.querySelector('.nav')).not.toBeNull();
    expect(html.querySelector('.profile__trigger')).not.toBeNull();
  });
});
