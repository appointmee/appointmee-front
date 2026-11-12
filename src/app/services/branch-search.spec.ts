import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { Navbar } from '../components/navbar/navbar';
import { Home } from '../pages/home/home';
import { authService } from './auth-service';
import { BranchSearch } from './branch-search';
import { sucursalService } from './sucursal-service';

@Component({ template: '' })
class EmptyPage {}

describe('Navegación de sucursales desde Home', () => {
  let router: Router;
  let search: BranchSearch;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [Home, Navbar],
      providers: [
        { provide: sucursalService, useValue: { filtrar: () => of([]) } },
        provideRouter([
          { path: '', component: EmptyPage },
          { path: 'sucursales', component: EmptyPage },
        ]),
        {
          provide: authService,
          useValue: {
            autenticado: signal(false),
            visitante: signal(true),
            restaurando: signal(false),
            perfil: signal(null),
            iniciales: signal('AM'),
            tieneAlgunRol: () => false,
            logout: () => of(undefined),
          },
        },
      ],
    });

    router = TestBed.inject(Router);
    search = TestBed.inject(BranchSearch);
  });

  afterEach(() => vi.useRealTimers());

  it('envía la búsqueda del hero a Sucursales después del debounce', async () => {
    await router.navigateByUrl('/');
    vi.useFakeTimers();

    search.search.setValue('Centro');
    await vi.advanceTimersByTimeAsync(349);
    expect(router.url).toBe('/');

    await vi.advanceTimersByTimeAsync(1);
    await vi.waitFor(() => expect(router.url).toBe('/sucursales?busqueda=Centro'));
  });

  it('envía Enter inmediatamente sin duplicar la navegación diferida', async () => {
    await router.navigateByUrl('/');
    const navigate = vi.spyOn(router, 'navigate');
    vi.useFakeTimers();

    search.search.setValue('  Centro  ');
    search.submit();
    await vi.waitFor(() => expect(router.url).toBe('/sucursales?busqueda=Centro'));
    await vi.advanceTimersByTimeAsync(350);

    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('no navega con un término de un carácter y muestra la ayuda', async () => {
    await router.navigateByUrl('/');
    vi.useFakeTimers();

    search.search.setValue('c');
    await vi.advanceTimersByTimeAsync(350);

    expect(router.url).toBe('/');
    expect(search.termTooShort()).toBe(true);
  });

  it('limpia el término y conserva la categoría existente', async () => {
    await router.navigateByUrl('/sucursales?busqueda=Centro&categoria=SPA');
    search.search.setValue('Centro', { emitEvent: false });

    search.clear();
    await vi.waitFor(() => expect(router.url).toBe('/sucursales?categoria=SPA'));

    expect(search.search.value).toBe('');
    expect(search.term()).toBe('');
  });

  it('Home ya no renderiza filtros, resultados ni tarjetas de sucursales', async () => {
    await router.navigateByUrl('/');
    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.branches')).toBeNull();
    expect(fixture.nativeElement.querySelector('.branch-filters')).toBeNull();
    expect(fixture.nativeElement.querySelector('.branch-card')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Sucursales disponibles');
  });

  it('mantiene las acciones del hero y Conocer sucursales apunta al listado', async () => {
    await router.navigateByUrl('/');
    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();
    const actions = Array.from(
      fixture.nativeElement.querySelectorAll('.hero__actions a') as NodeListOf<HTMLAnchorElement>,
    );

    expect(actions.map((link) => link.textContent?.trim())).toEqual([
      expect.stringContaining('Crear cuenta'),
      'Conocer sucursales',
    ]);
    expect(actions[1]?.getAttribute('href')).toBe('/sucursales');
  });

  it('redirige URLs antiguas de Home con filtros hacia Sucursales', async () => {
    await router.navigateByUrl('/?busqueda=Centro&categoria=SPA');
    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();

    await vi.waitFor(() =>
      expect(router.url).toBe('/sucursales?busqueda=Centro&categoria=SPA'),
    );
  });

  it('Navbar no renderiza buscador, disparador ni atajo visual', async () => {
    await router.navigateByUrl('/sucursales');
    const fixture = TestBed.createComponent(Navbar);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#navbar-search')).toBeNull();
    expect(fixture.nativeElement.querySelector('.search-trigger')).toBeNull();
    expect(fixture.nativeElement.querySelector('kbd')).toBeNull();
  });

  it('Navbar conserva logo, navegación y acciones de cuenta', async () => {
    await router.navigateByUrl('/sucursales');
    const fixture = TestBed.createComponent(Navbar);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.brand')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Iniciar sesión');
    expect(fixture.nativeElement.textContent).toContain('Crear cuenta');
  });

  it('Home usa el mismo navbar global que Sucursales, sin renderizar uno propio', async () => {
    await router.navigateByUrl('/');
    const homeFixture = TestBed.createComponent(Home);
    const navbarFixture = TestBed.createComponent(Navbar);
    homeFixture.detectChanges();
    navbarFixture.detectChanges();

    expect(homeFixture.nativeElement.querySelector('.landing-nav')).toBeNull();
    const navbarEnHome = navbarFixture.nativeElement.querySelector('header.navbar').outerHTML;

    await router.navigateByUrl('/sucursales');
    navbarFixture.detectChanges();

    expect(navbarFixture.nativeElement.querySelector('header.navbar').outerHTML).toBe(navbarEnHome);
  });
});
