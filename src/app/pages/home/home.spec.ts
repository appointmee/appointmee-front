import { provideHttpClient } from '@angular/common/http';
import { HttpErrorResponse } from '@angular/common/http';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Observable, Subject, throwError, of } from 'rxjs';

import { SucursalMiniDTO } from '../../models/sucursal';
import { sucursalService } from '../../services/sucursal-service';
import { Home } from './home';

@Component({ template: '' })
class EmptyPage {}

const PELUQUERIA: SucursalMiniDTO = {
  id: 17,
  nombre: 'Peluquería Centro',
  categoria: 'PELUQUERIA',
  fotoPerfil: null,
  puntuacion: 4,
  cantidadPuntuaciones: 8,
};

describe('Home branch autocomplete', () => {
  let router: Router;
  let filtrar: ReturnType<typeof vi.fn>;
  let listar: ReturnType<typeof vi.fn>;
  let categorias: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    filtrar = vi.fn<
      (categoria?: string | null, nombre?: string | null) => Observable<SucursalMiniDTO[]>
    >(() => of([]));
    listar = vi.fn(() => of([]));
    categorias = vi.fn(() => of([]));

    TestBed.configureTestingModule({
      imports: [Home],
      providers: [
        provideHttpClient(),
        provideRouter([
          { path: '', component: EmptyPage },
          { path: 'sucursales', component: EmptyPage },
          { path: 'sucursal/:id', component: EmptyPage },
        ]),
        { provide: sucursalService, useValue: { filtrar, listar, categorias } },
      ],
    });

    router = TestBed.inject(Router);
  });

  afterEach(() => vi.useRealTimers());

  it('does not render the former available branches section', () => {
    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.branches')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Sucursales disponibles');
  });

  it('renders eyebrow labels without decorative dots', () => {
    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.eyebrow__dot')).toHaveLength(0);
  });

  it('waits for two characters and debounces backend suggestions for 350 ms', async () => {
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('#branch-search') as HTMLInputElement;

    input.focus();
    input.value = 'p';
    input.dispatchEvent(new Event('input'));
    await vi.advanceTimersByTimeAsync(350);
    expect(filtrar).not.toHaveBeenCalled();

    input.value = 'pe';
    input.dispatchEvent(new Event('input'));
    await vi.advanceTimersByTimeAsync(349);
    expect(filtrar).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(filtrar).toHaveBeenCalledOnce();
    expect(filtrar).toHaveBeenCalledWith(null, 'pe');
  });

  it('keeps only the newest autocomplete response', async () => {
    vi.useFakeTimers();
    const first = new Subject<SucursalMiniDTO[]>();
    const second = new Subject<SucursalMiniDTO[]>();
    filtrar.mockReturnValueOnce(first).mockReturnValueOnce(second);
    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('#branch-search') as HTMLInputElement;

    input.focus();
    input.value = 'pe';
    input.dispatchEvent(new Event('input'));
    await vi.advanceTimersByTimeAsync(350);
    input.value = 'pelu';
    input.dispatchEvent(new Event('input'));
    await vi.advanceTimersByTimeAsync(350);

    second.next([PELUQUERIA]);
    fixture.detectChanges();
    first.next([]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(PELUQUERIA.nombre);
  });

  it('opens the existing detail route when a suggestion is selected', async () => {
    vi.useFakeTimers();
    filtrar.mockReturnValue(of([PELUQUERIA]));
    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('#branch-search') as HTMLInputElement;

    input.focus();
    input.value = 'pelu';
    input.dispatchEvent(new Event('input'));
    await vi.advanceTimersByTimeAsync(350);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.branch-suggestion') as HTMLButtonElement).click();

    await vi.waitFor(() => expect(router.url).toBe('/sucursal/17'));
  });

  it('navigates to the branches page with busqueda when the form is submitted', async () => {
    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('#branch-search') as HTMLInputElement;
    const form = fixture.nativeElement.querySelector('.branch-search') as HTMLFormElement;

    input.value = 'pelu';
    input.dispatchEvent(new Event('input'));
    form.dispatchEvent(new Event('submit'));

    await vi.waitFor(() => expect(router.url).toBe('/sucursales?busqueda=pelu'));
  });

  it('Enter with multiple results preserves the search in the listing even after hovering', async () => {
    vi.useFakeTimers();
    filtrar.mockReturnValue(
      of([PELUQUERIA, { ...PELUQUERIA, id: 18, nombre: 'Peluquería Norte' }]),
    );
    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('#branch-search') as HTMLInputElement;
    input.focus();
    input.value = '  pelu  ';
    input.dispatchEvent(new Event('input'));
    await vi.advanceTimersByTimeAsync(350);
    fixture.detectChanges();
    fixture.nativeElement
      .querySelector('.branch-suggestion')
      .dispatchEvent(new MouseEvent('mouseenter'));
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    input.dispatchEvent(enter);
    expect(enter.defaultPrevented).toBe(false);
    fixture.nativeElement.querySelector('.branch-search').dispatchEvent(new Event('submit'));
    await vi.waitFor(() => expect(router.url).toBe('/sucursales?busqueda=pelu'));
  });

  it('Enter opens the detail when the current search has exactly one result', async () => {
    vi.useFakeTimers();
    filtrar.mockReturnValue(of([PELUQUERIA]));
    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('#branch-search') as HTMLInputElement;
    input.focus();
    input.value = 'pelu';
    input.dispatchEvent(new Event('input'));
    await vi.advanceTimersByTimeAsync(350);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('.branch-search').dispatchEvent(new Event('submit'));
    await vi.waitFor(() => expect(router.url).toBe('/sucursal/17'));
  });

  it('does not use a previous single result while a different search is pending', async () => {
    vi.useFakeTimers();
    filtrar.mockReturnValue(of([PELUQUERIA]));
    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('#branch-search') as HTMLInputElement;
    input.value = 'pelu';
    input.dispatchEvent(new Event('input'));
    await vi.advanceTimersByTimeAsync(350);
    input.value = 'barbería';
    input.dispatchEvent(new Event('input'));
    fixture.nativeElement.querySelector('.branch-search').dispatchEvent(new Event('submit'));
    await vi.waitFor(() => expect(decodeURI(router.url)).toBe('/sucursales?busqueda=barbería'));
  });

  it('allows selecting a particular suggestion with arrows and Enter', async () => {
    vi.useFakeTimers();
    filtrar.mockReturnValue(of([PELUQUERIA, { ...PELUQUERIA, id: 18 }]));
    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('#branch-search') as HTMLInputElement;
    input.focus();
    input.value = 'pelu';
    input.dispatchEvent(new Event('input'));
    await vi.advanceTimersByTimeAsync(350);
    fixture.detectChanges();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    input.dispatchEvent(enter);
    expect(enter.defaultPrevented).toBe(true);
    await vi.waitFor(() => expect(router.url).toBe('/sucursal/18'));
  });

  describe.skip('listado de sucursales destacado en la home (US-HOME-05) - eliminado', () => {
    it('muestra un skeleton mientras carga el listado inicial', () => {
      const listado$ = new Subject<SucursalMiniDTO[]>();
      listar.mockReturnValue(listado$);

      const fixture = TestBed.createComponent(Home);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.card--skeleton')).not.toBeNull();
      expect(fixture.nativeElement.querySelector('.grid[aria-busy="true"]')).not.toBeNull();
    });

    it('reemplaza el skeleton por la misma cantidad de tarjetas del layout sin saltos', () => {
      const listado$ = new Subject<SucursalMiniDTO[]>();
      listar.mockReturnValue(listado$);
      const seisSucursales = Array.from({ length: 6 }, (_, index) => ({
        ...PELUQUERIA,
        id: PELUQUERIA.id + index,
        nombre: `${PELUQUERIA.nombre} ${index + 1}`,
      }));

      const fixture = TestBed.createComponent(Home);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('.card--skeleton').length).toBe(6);

      listado$.next(seisSucursales);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.card--skeleton')).toBeNull();
      expect(fixture.nativeElement.querySelectorAll('.card:not(.card--skeleton)').length).toBe(6);
      expect(fixture.nativeElement.textContent).toContain(PELUQUERIA.nombre);
    });

    it('limita Home a seis sucursales destacadas y ofrece abrir el listado completo', () => {
      const listado = Array.from({ length: 8 }, (_, index) => ({
        ...PELUQUERIA,
        id: PELUQUERIA.id + index,
        nombre: `${PELUQUERIA.nombre} ${index + 1}`,
      }));
      listar.mockReturnValue(of(listado));

      const fixture = TestBed.createComponent(Home);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelectorAll('.grid .card').length).toBe(6);
      const enlacesSucursales = Array.from(
        fixture.nativeElement.querySelectorAll('a[href^="/sucursales"]'),
      ) as HTMLAnchorElement[];
      expect(enlacesSucursales.some((enlace) => enlace.textContent?.includes('Ver todas')))
        .toBe(true);
    });

    it('muestra estado vacío "no hay sucursales en la plataforma" sin filtros', () => {
      listar.mockReturnValue(of([]));

      const fixture = TestBed.createComponent(Home);
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('No hay sucursales en la plataforma');
      expect(fixture.nativeElement.textContent).toContain('Reintentar');
    });

    it('anuncia y bloquea el reintento desde el estado vacío mientras vuelve a cargar', () => {
      const listado$ = new Subject<SucursalMiniDTO[]>();
      listar.mockReturnValueOnce(of([])).mockReturnValue(listado$);

      const fixture = TestBed.createComponent(Home);
      fixture.detectChanges();
      const retry = fixture.nativeElement.querySelector(
        '.vacio button.estado__link',
      ) as HTMLButtonElement;
      retry.click();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.grid[aria-busy="true"]')).not.toBeNull();
      expect(fixture.nativeElement.querySelector('.sucursales-destacadas__aviso').textContent)
        .toContain('Cargando');
      expect(listar).toHaveBeenCalledTimes(2);
      listado$.next([]);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.vacio')).not.toBeNull();
    });

    it('muestra estado vacío diferenciado "no hay resultados para tu búsqueda" con filtros', () => {
      listar.mockReturnValue(of([]));
      filtrar.mockReturnValue(of([]));
      categorias.mockReturnValue(of(['PELUQUERIA']));

      const fixture = TestBed.createComponent(Home);
      fixture.detectChanges();

      const input = fixture.nativeElement.querySelector(
        '.sucursales-destacadas .search__input',
      ) as HTMLInputElement;
      input.value = 'pelu';
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('No hay resultados para tu búsqueda');
      expect(fixture.nativeElement.textContent).toContain('Limpiar filtros');
      expect(fixture.nativeElement.textContent).not.toContain('No hay sucursales en la plataforma');
    });

    it('muestra error inline con Reintentar y enlace al Home al fallar la carga inicial', () => {
      listar.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));

      const fixture = TestBed.createComponent(Home);
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('No pudimos cargar las sucursales');
      const retry = fixture.nativeElement.querySelector(
        '.sucursales-destacadas button.estado__link',
      ) as HTMLButtonElement;
      expect(retry).not.toBeNull();
      expect(retry.textContent).toContain('Reintentar');
      expect(fixture.nativeElement.querySelector('a[routerLink="/"]')).not.toBeNull();
      expect(router.url).not.toBe('/error');
    });

    it('muestra un mensaje específico de conexión cuando no hay red (status 0)', () => {
      listar.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 0 })));

      const fixture = TestBed.createComponent(Home);
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('No hay conexión a Internet');
      expect(fixture.nativeElement.textContent).not.toContain('Failed to fetch');
      expect(fixture.nativeElement.textContent).not.toContain('500');
    });

    it('anuncia los estados con aria-live', () => {
      const listado$ = new Subject<SucursalMiniDTO[]>();
      listar.mockReturnValue(listado$);

      const fixture = TestBed.createComponent(Home);
      fixture.detectChanges();

      const aviso = fixture.nativeElement.querySelector('.sucursales-destacadas__aviso');
      expect(aviso).not.toBeNull();
      expect(aviso.getAttribute('aria-live')).toBe('polite');
      expect(aviso.textContent).toContain('Cargando');

      listado$.next([]);
      fixture.detectChanges();

      const vacio = fixture.nativeElement.querySelector('.vacio[role="status"]');
      expect(vacio).not.toBeNull();
    });

    it('conserva el término y la categoría cuando falla una búsqueda o filtro', () => {
      categorias.mockReturnValue(of(['PELUQUERIA', 'SPA']));
      filtrar.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));

      const fixture = TestBed.createComponent(Home);
      fixture.detectChanges();

      const input = fixture.nativeElement.querySelector(
        '.sucursales-destacadas .search__input',
      ) as HTMLInputElement;
      input.value = 'pelu';
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      const chips = Array.from(
        fixture.nativeElement.querySelectorAll('.categoria-chip'),
      ) as HTMLElement[];
      const chipPel = chips.find((b) => b.textContent?.includes('Peluqueria'))!;
      chipPel.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      fixture.detectChanges();

      // filtrar se reenvió con categoría y término conservados.
      expect(filtrar).toHaveBeenCalledWith('PELUQUERIA', 'pelu', true);
      expect(fixture.nativeElement.textContent).toContain('No pudimos cargar las sucursales');

      // Los filtros se conservan tras el error.
      expect(input.value).toBe('pelu');
      expect(chipPel.getAttribute('aria-pressed')).toBe('true');

      // Al reintentar se vuelve a consultar con los mismos filtros.
      const retry = fixture.nativeElement.querySelector(
        '.sucursales-destacadas button.estado__link',
      ) as HTMLButtonElement;
      retry.click();
      fixture.detectChanges();
      expect(filtrar).toHaveBeenLastCalledWith('PELUQUERIA', 'pelu', true);
    });

    it('el botón Reintentar muestra estado de carga y bloquea múltiples clics', () => {
      const listado$ = new Subject<SucursalMiniDTO[]>();
      // Primera carga falla (error visible con botón Reintentar); las siguientes usan el Subject.
      listar.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500 })));
      listar.mockReturnValue(listado$);

      const fixture = TestBed.createComponent(Home);
      fixture.detectChanges();

      const retry = fixture.nativeElement.querySelector(
        '.sucursales-destacadas button.estado__link',
      ) as HTMLButtonElement;
      expect(retry).not.toBeNull();
      expect(retry.textContent).toContain('Reintentar');
      expect(retry.disabled).toBe(false);

      retry.click();
      fixture.detectChanges();

      expect(retry.disabled).toBe(true);
      expect(retry.textContent).toContain('Reintentando');

      retry.click(); // segundo clic ignorado mientras hay una petición en vuelo
      fixture.detectChanges();

      expect(listar).toHaveBeenCalledTimes(2); // carga inicial + un solo reintento

      listado$.next([PELUQUERIA]);
      fixture.detectChanges();

      // Tras resolver la petición, el botón de reintentar desaparece y se muestran las tarjetas.
      expect(
        fixture.nativeElement.querySelector('.sucursales-destacadas button.estado__link'),
      ).toBeNull();
      expect(fixture.nativeElement.textContent).toContain(PELUQUERIA.nombre);
    });
  });
});
