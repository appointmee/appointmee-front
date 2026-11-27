import { HttpErrorResponse } from '@angular/common/http';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';
import { ApiErrors } from '../../http/api-errors';
import { PaginaSucursalesDTO, SucursalMiniDTO } from '../../models/sucursal';
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

function pagina(
  content: readonly SucursalMiniDTO[] = [CENTRO],
  totalElements = content.length,
  totalPages = 1,
  number = 0,
  size = 12,
): PaginaSucursalesDTO {
  return { content: [...content], totalElements, totalPages, number, size };
}

describe('Sucursales', () => {
  let router: Router;
  let listarPaginado: ReturnType<typeof vi.fn>;
  let categorias: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    listarPaginado = vi.fn<
      (categoria: string | null, nombre: string | null, page: number, size: number)
        => Observable<PaginaSucursalesDTO>
    >(() => of(pagina()));
    categorias = vi.fn<() => Observable<string[]>>(() => of(['SPA', 'BARBERIA']));

    TestBed.configureTestingModule({
      imports: [Sucursales],
      providers: [
        provideRouter([
          { path: 'sucursales', component: EmptyPage },
          { path: 'sucursal/:id', component: EmptyPage },
        ]),
        { provide: sucursalService, useValue: { listarPaginado, categorias } },
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

    expect(listarPaginado).toHaveBeenCalledWith('SPA', 'Centro', 0, 12, false);
  });

  it('envía la página de la URL convertida a base cero', async () => {
    await create('/sucursales?pagina=3');

    expect(listarPaginado).toHaveBeenCalledWith(null, null, 2, 12, false);
  });

  it('espera las categorías antes de buscar con los filtros iniciales de la URL', async () => {
    const categoriasPendientes = new Subject<string[]>();
    categorias.mockReturnValue(categoriasPendientes);
    const fixture = await create('/sucursales?busqueda=Flores&categoria=CAFE');

    expect(listarPaginado).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[aria-busy="true"]')).toBeTruthy();

    categoriasPendientes.next(['CAFE']);
    fixture.detectChanges();

    expect(listarPaginado).toHaveBeenCalledOnce();
    expect(listarPaginado).toHaveBeenCalledWith('CAFE', 'Flores', 0, 12, false);
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
    expect(listarPaginado).toHaveBeenCalledWith(null, null, 0, 12, false);
    expect(fixture.nativeElement.querySelector('.categoria-chip').getAttribute('aria-pressed')).toBe('true');
  });

  it('mantiene el listado y Todas si falla la API de categorías', async () => {
    categorias.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    const fixture = await create('/sucursales?categoria=SPA');
    fixture.detectChanges();
    expect(listarPaginado).toHaveBeenCalledWith(null, null, 0, 12, false);
    expect(fixture.nativeElement.querySelectorAll('.categoria-chip')).toHaveLength(1);
    expect(fixture.nativeElement.querySelector('.categorias__aviso').textContent).toContain('No pudimos cargar las categorías');
    expect(fixture.nativeElement.querySelector('.card')).toBeTruthy();
  });

  it('anuncia los resultados y la categoría seleccionada', async () => {
    const fixture = await create('/sucursales?categoria=SPA');
    fixture.detectChanges();
    const anuncio = fixture.nativeElement.querySelector('[aria-live="polite"][aria-atomic="true"]');
    expect(anuncio.textContent).toContain('1 sucursal encontrada');
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
    expect(listarPaginado).toHaveBeenLastCalledWith('SPA', 'Centro', 0, 12, false);
  });

  it('sincroniza la categoria con la URL sin perder la busqueda', async () => {
    const fixture = await create('/sucursales?busqueda=Centro');
    const spa = Array.from(
      fixture.nativeElement.querySelectorAll('.categoria-chip') as NodeListOf<HTMLButtonElement>,
    ).find((button) => button.textContent?.trim() === 'Spa');

    spa?.click();
    await vi.waitFor(() => expect(router.url).toContain('categoria=SPA'));

    expect(router.url).toContain('busqueda=Centro');
    expect(listarPaginado).toHaveBeenLastCalledWith('SPA', 'Centro', 0, 12, false);
  });

  it('reacciona a cambios externos de los query params', async () => {
    await create();

    await router.navigate([], { queryParams: { busqueda: 'Norte', categoria: 'BARBERIA' } });
    await vi.waitFor(() =>
      expect(listarPaginado).toHaveBeenLastCalledWith('BARBERIA', 'Norte', 0, 12, false),
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
    listarPaginado.mockReturnValue(new Subject<PaginaSucursalesDTO>());
    const fixture = await create();

    expect(fixture.nativeElement.querySelector('[aria-busy="true"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelectorAll('.card--skeleton')).toHaveLength(6);
  });

  it('muestra el estado vacío sin eliminar los controles', async () => {
    listarPaginado.mockReturnValue(of(pagina([], 0, 0)));
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
    listarPaginado
      .mockReturnValueOnce(
        throwError(() => new HttpErrorResponse({ status: 0, statusText: 'Offline' })),
      )
      .mockReturnValueOnce(of(pagina()));
    const fixture = await create('/sucursales?busqueda=Centro&categoria=SPA');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();
    (fixture.nativeElement.querySelector('button.estado__link') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(listarPaginado).toHaveBeenLastCalledWith('SPA', 'Centro', 0, 12, false);
    expect(fixture.nativeElement.querySelector('.card')).toBeTruthy();
  });

  it('busca IDs numéricos en el backend paginado sin listar todo', async () => {
    const fixture = await create('/sucursales?busqueda=1&categoria=SPA');
    fixture.detectChanges();

    expect(listarPaginado).toHaveBeenCalledWith('SPA', '1', 0, 12, false);
    expect(fixture.nativeElement.querySelectorAll('.card')).toHaveLength(1);
  });

  it('permite buscar escribiendo un ID numérico de un dígito', async () => {
    const fixture = await create();
    vi.useFakeTimers();
    const input = fixture.nativeElement.querySelector('.search__input') as HTMLInputElement;

    input.value = '1';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(350);
    fixture.detectChanges();

    expect(listarPaginado).toHaveBeenLastCalledWith(null, '1', 0, 12, false);
    expect(fixture.nativeElement.querySelectorAll('.card')).toHaveLength(1);
    expect(fixture.nativeElement.querySelector('.search__hint--alerta')).toBeNull();
  });

  it('muestra paginación con flechas deshabilitadas en los extremos', async () => {
    listarPaginado.mockReturnValue(of(pagina([CENTRO], 30, 3, 2)));
    const fixture = await create('/sucursales?pagina=3');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('ds-pagination .ds-pagination__prev')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('ds-pagination .ds-pagination__next')).toBeTruthy();
    expect(
      (fixture.nativeElement.querySelector('ds-pagination .ds-pagination__next') as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (fixture.nativeElement.querySelector('ds-pagination .ds-pagination__prev') as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });

  it('la flecha siguiente pide la página 0-based correspondiente', async () => {
    listarPaginado.mockReturnValue(of(pagina([CENTRO], 30, 3, 0)));
    const fixture = await create();

    (fixture.nativeElement.querySelector('ds-pagination .ds-pagination__next') as HTMLButtonElement)
      .click();
    await vi.waitFor(() => expect(router.url).toContain('pagina=2'));
    expect(listarPaginado).toHaveBeenLastCalledWith(null, null, 1, 12, false);
  });

  it('permite navegar directamente a una página y conserva los filtros', async () => {
    listarPaginado.mockReturnValue(of(pagina([CENTRO], 30, 3, 0)));
    const fixture = await create('/sucursales?categoria=SPA');
    const input = fixture.nativeElement.querySelector(
      'ds-pagination input[type="number"]',
    ) as HTMLInputElement;

    input.value = '3';
    input.dispatchEvent(new Event('input'));
    (fixture.nativeElement.querySelector('ds-pagination .ds-pagination__go') as HTMLButtonElement)
      .click();
    await vi.waitFor(() => expect(router.url).toContain('pagina=3'));

    expect(router.url).toContain('categoria=SPA');
    expect(listarPaginado).toHaveBeenLastCalledWith('SPA', null, 2, 12, false);
  });

  it('cambiar un filtro vuelve a la primera página y limpia el parámetro', async () => {
    listarPaginado.mockReturnValue(of(pagina([CENTRO], 30, 3, 0)));
    const fixture = await create('/sucursales?pagina=3');
    const spa = Array.from(
      fixture.nativeElement.querySelectorAll('.categoria-chip') as NodeListOf<HTMLButtonElement>,
    ).find((button) => button.textContent?.trim() === 'Spa');

    spa?.click();
    await vi.waitFor(() => expect(router.url).not.toContain('pagina='));
    expect(listarPaginado).toHaveBeenLastCalledWith('SPA', null, 0, 12, false);
  });

  it('oculta la paginación cuando hay una sola página', async () => {
    const fixture = await create();

    expect(fixture.nativeElement.querySelector('ds-pagination')).toBeNull();
  });
});
