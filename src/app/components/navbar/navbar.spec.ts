import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Navbar } from './navbar';
import { authService } from '../../services/auth-service';

@Component({ selector: 'app-navbar-test-page', template: '' })
class EmptyPage {}

describe('Buscador del navbar', () => {
  beforeEach(() => TestBed.resetTestingModule());
  it('muestra iniciales si la foto falla y vuelve a intentar cuando cambia la URL', async () => {
    const perfil = signal({ fotoPerfil: 'https://res.cloudinary.com/demo/image/upload/avatar.jpg', email: 'ana@example.com' });
    TestBed.configureTestingModule({
      imports: [Navbar],
      providers: [
        provideRouter([{ path: 'sucursales', component: EmptyPage }]),
        { provide: authService, useValue: {
          autenticado: signal(true), visitante: signal(false), restaurando: signal(false),
          perfil, iniciales: signal('AN'), tieneAlgunRol: () => false,
        } },
      ],
    });
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/sucursales');
    const fixture = TestBed.createComponent(Navbar);
    fixture.detectChanges();
    const photo = fixture.nativeElement.querySelector('.profile__avatar img') as HTMLImageElement;
    expect(photo.src).toContain('avatar.jpg');
    photo.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.profile__avatar img')).toBeNull();
    expect(fixture.nativeElement.querySelector('.profile__avatar').textContent).toContain('AN');
    fixture.nativeElement.querySelector('.profile__trigger').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.menu__avatar').textContent).toContain('AN');
    perfil.set({ ...perfil(), fotoPerfil: 'https://res.cloudinary.com/demo/image/upload/nueva.jpg' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.profile__avatar img').src).toContain('nueva.jpg');
    expect(fixture.nativeElement.querySelector('.menu__avatar img').src).toContain('nueva.jpg');
  });
  it('expande la lupa y permite buscar sucursales desde el navbar', async () => {
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
      ],
    });
    const router = TestBed.inject(Router);
    const fixture = TestBed.createComponent(Navbar);
    await router.navigateByUrl('/'); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#navbar-search')).toBeNull();
    const trigger = fixture.nativeElement.querySelector('.search-trigger') as HTMLButtonElement;
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    trigger.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    const input = fixture.nativeElement.querySelector('#navbar-search') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(document.activeElement).toBe(input);
    input.value = 'Centro';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.search') as HTMLFormElement).dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    await vi.waitFor(() => expect(router.url).toBe('/sucursales?busqueda=Centro'));

    (fixture.nativeElement.querySelector('.search-trigger') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    const currentInput = fixture.nativeElement.querySelector('#navbar-search') as HTMLInputElement;
    currentInput.value = 'c';
    currentInput.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.search') as HTMLFormElement).dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.search__hint').textContent).toContain('2 caracteres');
    expect(router.url).toBe('/sucursales?busqueda=Centro');

    const searchTrigger = fixture.nativeElement.querySelector('.search-trigger') as HTMLButtonElement;
    searchTrigger.click();
    fixture.detectChanges();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#navbar-search')).toBeNull();
    expect(searchTrigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(searchTrigger);

    await router.navigateByUrl('/sucursales?busqueda=pelu'); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#navbar-search')).toBeNull();
    expect(fixture.nativeElement.querySelector('.search-trigger')).not.toBeNull();
    await router.navigateByUrl('/'); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#navbar-search')).toBeNull();
  });
});

describe('Acceso a Mis Turnos', () => {
  beforeEach(() => TestBed.resetTestingModule());

  async function renderizar(roles: readonly string[]): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      imports: [Navbar],
      providers: [
        provideRouter([
          { path: 'sucursales', component: EmptyPage },
          { path: 'mis-turnos', component: EmptyPage },
          { path: 'admin', component: EmptyPage },
        ]),
        {
          provide: authService,
          useValue: {
            autenticado: signal(true),
            visitante: signal(false),
            restaurando: signal(false),
            perfil: signal(null),
            iniciales: signal('AM'),
            tieneAlgunRol: (...solicitados: string[]) =>
              solicitados.some((rol) => roles.includes(rol)),
          },
        },
      ],
    });
    const router = TestBed.inject(Router);
    const fixture = TestBed.createComponent(Navbar);
    await router.navigateByUrl('/sucursales');
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('oculta Mis Turnos a administradores', async () => {
    const html = await renderizar(['ADMINISTRADOR']);
    expect(html.querySelector('.nav a[href="/mis-turnos"]')).toBeNull();
    expect(html.querySelector('.nav a[href="/admin"]')).not.toBeNull();
  });

  it('muestra Mis Turnos a clientes y empleadores', async () => {
    const html = await renderizar(['CLIENTE', 'EMPLEADOR']);
    expect(html.querySelector('.nav a[href="/mis-turnos"]')).not.toBeNull();
  });

  it('ubica la lupa inmediatamente antes del enlace Home', async () => {
    const html = await renderizar(['CLIENTE']);
    const lupa = html.querySelector('.navbar__search-wrap') as HTMLElement;
    const home = html.querySelector('.nav a[href="/"]') as HTMLElement;

    expect(lupa).not.toBeNull();
    expect(home).not.toBeNull();
    expect(lupa.compareDocumentPosition(home) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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
