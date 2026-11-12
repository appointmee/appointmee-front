import { HttpErrorResponse } from '@angular/common/http';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';
import { ApiErrors } from '../../http/api-errors';
import { SucursalMiniDTO } from '../../models/sucursal';
import { sucursalService } from '../../services/sucursal-service';
import { Sucursales } from './sucursales';

@Component({ template: '' })
class EmptyPage {}

const CENTRO: SucursalMiniDTO = {
  id: 1,
  nombre: 'Centro',
  categoria: 'SPA',
  fotoPerfil: null,
  puntuacion: 4.5,
  cantidadPuntuaciones: 10,
};

describe('Sucursales', () => {
  let router: Router;
  let filtrar: ReturnType<typeof vi.fn>;
  let listar: ReturnType<typeof vi.fn>;
  let categorias: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    filtrar = vi.fn<(categoria?: string | null, nombre?: string | null) => Observable<SucursalMiniDTO[]>>(
      () => of([CENTRO]),
    );
    listar = vi.fn<() => Observable<SucursalMiniDTO[]>>(() => of([CENTRO]));
    categorias = vi.fn<() => Observable<string[]>>(() => of(['SPA', 'BARBERIA']));

    TestBed.configureTestingModule({
      imports: [Sucursales],
      providers: [
        provideRouter([
          { path: 'sucursales', component: EmptyPage },
          { path: 'sucursal/:id', component: EmptyPage },
        ]),
        { provide: sucursalService, useValue: { filtrar, listar, categorias } },
        { provide: ApiErrors, useValue: { dismiss: vi.fn() } },
      ],
    });
    router = TestBed.inject(Router);
  });

  afterEach(() => vi.useRealTimers());

  async function create(url = '/sucursales') {
    await router.navigateByUrl(url);
    const fixture = TestBed.createComponent(Sucursales);
    fixture.detectChanges();
    return fixture;
  }

  it('combina busqueda y categoria recibidas por query params', async () => {
    await create('/sucursales?busqueda=Centro&categoria=SPA');

    expect(filtrar).toHaveBeenCalledWith('SPA', 'Centro');
  });

  it('ubica búsqueda y categorías en la barra lateral antes del listado', async () => {
    const fixture = await create();
    const sidebar = fixture.nativeElement.querySelector('aside.listado__sidebar') as HTMLElement;
    const results = fixture.nativeElement.querySelector('.listado__results') as HTMLElement;

    expect(sidebar.getAttribute('aria-label')).toBe('Filtros de sucursales');
    expect(sidebar.querySelector('.search__input')).toBeTruthy();
    expect(sidebar.querySelector('.categorias')).toBeTruthy();
    expect(sidebar.compareDocumentPosition(results) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('abre y cierra el listado de categorías desde el botón responsive', async () => {
    const fixture = await create();
    const toggle = fixture.nativeElement.querySelector('.categorias__toggle') as HTMLButtonElement;
    const listado = fixture.nativeElement.querySelector('#sucursales-categorias') as HTMLElement;

    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    toggle.click();
    fixture.detectChanges();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(listado.classList.contains('categorias--abiertas')).toBe(true);

    const spa = Array.from(listado.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'Spa');
    spa?.click();
    fixture.detectChanges();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(listado.classList.contains('categorias--abiertas')).toBe(false);
  });

  it('ignora una categoría inválida sin enviarla al backend', async () => {
    const fixture = await create('/sucursales?categoria=INEXISTENTE');
    expect(filtrar).toHaveBeenCalledWith(null, '');
    expect(fixture.nativeElement.querySelector('.categoria-chip').getAttribute('aria-pressed')).toBe('true');
  });

  it('mantiene el listado y Todas si falla la API de categorías', async () => {
    categorias.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    const fixture = await create('/sucursales?categoria=SPA');
    fixture.detectChanges();
    expect(filtrar).toHaveBeenCalledWith(null, '');
    expect(fixture.nativeElement.querySelectorAll('.categoria-chip')).toHaveLength(1);
    expect(fixture.nativeElement.querySelector('.categorias__aviso').textContent).toContain('No pudimos cargar las categorías');
    expect(fixture.nativeElement.querySelector('.card')).toBeTruthy();
  });

  it('anuncia los resultados y la categoría seleccionada', async () => {
    const fixture = await create('/sucursales?categoria=SPA');
    fixture.detectChanges();
    const anuncio = fixture.nativeElement.querySelector('[aria-live="polite"][aria-atomic="true"]');
    expect(anuncio.textContent).toContain('1 sucursales encontradas');
    expect(anuncio.textContent).toContain('Spa');
  });

  it('sincroniza el texto buscado con la URL y conserva la categoria', async () => {
    const fixture = await create('/sucursales?categoria=SPA');
    vi.useFakeTimers();
    const input = fixture.nativeElement.querySelector('.search__input') as HTMLInputElement;

    input.value = 'Centro';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await vi.waitFor(() => expect(router.url).toContain('busqueda=Centro'));
    await vi.advanceTimersByTimeAsync(300);

    expect(router.url).toContain('categoria=SPA');
    expect(filtrar).toHaveBeenLastCalledWith('SPA', 'Centro');
  });

  it('sincroniza la categoria con la URL sin perder la busqueda', async () => {
    const fixture = await create('/sucursales?busqueda=Centro');
    const spa = Array.from(
      fixture.nativeElement.querySelectorAll('.categoria-chip') as NodeListOf<HTMLButtonElement>,
    ).find((button) => button.textContent?.trim() === 'Spa');

    spa?.click();
    await vi.waitFor(() => expect(router.url).toContain('categoria=SPA'));

    expect(router.url).toContain('busqueda=Centro');
    expect(filtrar).toHaveBeenLastCalledWith('SPA', 'Centro');
  });

  it('reacciona a cambios externos de los query params', async () => {
    await create();

    await router.navigate([], { queryParams: { busqueda: 'Norte', categoria: 'BARBERIA' } });
    await vi.waitFor(() =>
      expect(filtrar).toHaveBeenLastCalledWith('BARBERIA', 'Norte'),
    );
  });

  it('mantiene la navegación de cada tarjeta hacia su detalle', async () => {
    const fixture = await create();
    fixture.detectChanges();
    const card = fixture.nativeElement.querySelector('.card') as HTMLAnchorElement;

    expect(card.getAttribute('href')).toBe('/sucursal/1');
    expect(card.getAttribute('aria-label')).toContain('Centro');
  });

  it('muestra skeletons mientras la consulta está cargando', async () => {
    filtrar.mockReturnValue(new Subject<SucursalMiniDTO[]>());
    const fixture = await create();

    expect(fixture.nativeElement.querySelector('[aria-busy="true"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelectorAll('.card--skeleton')).toHaveLength(6);
  });

  it('muestra el estado vacío sin eliminar los controles', async () => {
    filtrar.mockReturnValue(of([]));
    const fixture = await create('/sucursales?busqueda=Inexistente');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.estado__vacio')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.estado__titulo').textContent).toContain(
      'No encontramos sucursales para «Inexistente».',
    );
    expect(fixture.nativeElement.querySelector('.search__input')).toBeTruthy();
    expect(
      fixture.nativeElement.querySelector('.estado__accion').textContent,
    ).toContain('Limpiar búsqueda');
  });

  it('muestra error recuperable y reintenta con los mismos filtros', async () => {
    filtrar
      .mockReturnValueOnce(
        throwError(() => new HttpErrorResponse({ status: 0, statusText: 'Offline' })),
      )
      .mockReturnValueOnce(of([CENTRO]));
    const fixture = await create('/sucursales?busqueda=Centro&categoria=SPA');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();
    (fixture.nativeElement.querySelector('button.estado__link') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(filtrar).toHaveBeenLastCalledWith('SPA', 'Centro');
    expect(fixture.nativeElement.querySelector('.card')).toBeTruthy();
  });

  it('filtra búsquedas numéricas por id y categoría sin cambiar contratos', async () => {
    listar.mockReturnValue(of([CENTRO, { ...CENTRO, id: 2, categoria: 'BARBERIA' }]));
    const fixture = await create('/sucursales?busqueda=1&categoria=SPA');
    fixture.detectChanges();

    expect(listar).toHaveBeenCalledOnce();
    expect(filtrar).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelectorAll('.card')).toHaveLength(1);
  });
});
