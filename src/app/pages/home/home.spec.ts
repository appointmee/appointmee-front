import { provideHttpClient } from '@angular/common/http';
import { HttpErrorResponse } from '@angular/common/http';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Observable, Subject, throwError, of } from 'rxjs';

import { RecomendacionesSucursalesDTO, SucursalMiniDTO } from '../../models/sucursal';
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

function recomendacionesVacias(): RecomendacionesSucursalesDTO {
  return {
    mejores: [],
    masDemandadas: [],
    nuevas: [],
    vistasRecientes: [],
    paraVos: [],
    todas: [],
  };
}

describe('Home como pantalla de descubrimiento sin filtros (SCRUM-364)', () => {
  let router: Router;
  let filtrar: ReturnType<typeof vi.fn>;
  let listar: ReturnType<typeof vi.fn>;
  let categorias: ReturnType<typeof vi.fn>;
  let recomendaciones: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    filtrar = vi.fn<
      (categoria?: string | null, nombre?: string | null) => Observable<SucursalMiniDTO[]>
    >(() => of([]));
    listar = vi.fn(() => of([]));
    categorias = vi.fn(() => of([]));
    recomendaciones = vi.fn(() => of(recomendacionesVacias()));

    TestBed.configureTestingModule({
      imports: [Home],
      providers: [
        provideHttpClient(),
        provideRouter([
          { path: '', component: EmptyPage },
          { path: 'sucursales', component: EmptyPage },
          { path: 'sucursal/:id', component: EmptyPage },
        ]),
        { provide: sucursalService, useValue: { filtrar, listar, categorias, recomendaciones } },
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

  it('incluye la secuencia visual de confirmación y el recorrido de pasos', () => {
    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('.booking-card__slot--chosen .hero-card__slot-check'),
    ).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.hero-card__mini')?.textContent).toContain(
      'Turno confirmado',
    );
    expect(fixture.nativeElement.querySelector('.steps__track-fill')).not.toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.steps .step__number')).toHaveLength(7);
    expect(fixture.nativeElement.querySelector('.booking-story .hero-card')).not.toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.section__glow')).toHaveLength(3);
  });

  it('muestra la abeja proporcionada en el hero como imagen decorativa', () => {
    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();
    const bee = fixture.nativeElement.querySelector('.hero__bee') as HTMLImageElement | null;

    expect(bee?.getAttribute('src')).toBe('abeja-icono.svg');
    expect(bee?.getAttribute('alt')).toBe('');
    expect(fixture.nativeElement.querySelector('.hero__visual .hero-card')).toBeNull();
  });

  it('no ofrece buscador ni filtros en la pantalla de descubrimiento', () => {
    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;

    expect(raiz.querySelector('[role="search"]')).toBeNull();
    expect(raiz.querySelector('input, select, [role="combobox"]')).toBeNull();
    expect(raiz.querySelector('.branch-search, .branch-suggestions')).toBeNull();
    expect(filtrar).not.toHaveBeenCalled();
  });

  it('mantiene «Conocer sucursales» como entrada al listado completo', () => {
    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();

    const enlaces = Array.from(
      fixture.nativeElement.querySelectorAll('.hero__actions a'),
    ) as HTMLAnchorElement[];
    const conocer = enlaces.find((enlace) => enlace.textContent?.includes('Conocer sucursales'));

    expect(conocer?.getAttribute('href')).toBe('/sucursales');
  });

  describe('secciones horizontales de descubrimiento (SCRUM-364)', () => {
    function sucursal(id: number, nombre: string): SucursalMiniDTO {
      return {
        id,
        nombre,
        categoria: 'PELUQUERIA',
        fotoPerfil: null,
        puntuacion: 4.5,
        cantidadPuntuaciones: 8,
      };
    }

    it('muestra las seis secciones en el orden acordado, cada una con su carrusel', () => {
      recomendaciones.mockReturnValue(
        of({
          mejores: [sucursal(1, 'Mejor')],
          masDemandadas: [sucursal(2, 'Demandada')],
          nuevas: [sucursal(3, 'Nueva')],
          vistasRecientes: [sucursal(4, 'Visitada')],
          paraVos: [sucursal(5, 'Para vos')],
          todas: [sucursal(6, 'Todas')],
        }),
      );

      const fixture = TestBed.createComponent(Home);
      fixture.detectChanges();

      const titulos = Array.from(
        fixture.nativeElement.querySelectorAll('.descubrir .carrusel__titulo'),
      ) as HTMLElement[];
      expect(titulos.map((titulo) => titulo.textContent?.trim())).toEqual([
        'Las mejores de AppointMee',
        'Las más demandadas',
        'Nuevas en AppointMee',
        'Visto recientemente',
        'Recomendado para vos',
        'Todas las sucursales',
      ]);
      expect(fixture.nativeElement.querySelectorAll('.carrusel__track')).toHaveLength(6);
      expect(fixture.nativeElement.querySelectorAll('.carrusel__card')).toHaveLength(6);
      expect(recomendaciones).toHaveBeenCalledOnce();
    });

    it('oculta las secciones vacías y ofrece «Ver todas» sólo en la preview', () => {
      recomendaciones.mockReturnValue(
        of({
          ...recomendacionesVacias(),
          mejores: [sucursal(1, 'Mejor')],
          todas: [sucursal(6, 'Todas')],
        }),
      );

      const fixture = TestBed.createComponent(Home);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelectorAll('.carrusel')).toHaveLength(2);
      expect(fixture.nativeElement.textContent).toContain('Las mejores de AppointMee');
      expect(fixture.nativeElement.textContent).not.toContain('Visto recientemente');
      const verTodas = fixture.nativeElement.querySelector('.carrusel__ver-todas');
      expect(verTodas.getAttribute('href')).toBe('/sucursales');
      expect(verTodas.textContent).toContain('Ver todas');
    });

    it('muestra skeletons accesibles mientras cargan las recomendaciones', () => {
      recomendaciones.mockReturnValue(new Subject<RecomendacionesSucursalesDTO>());

      const fixture = TestBed.createComponent(Home);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.descubrir__skeleton[aria-busy="true"]')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('[role="status"]').textContent).toContain(
        'Cargando recomendaciones',
      );
      expect(fixture.nativeElement.querySelectorAll('.descubrir__skeleton-card')).toHaveLength(8);
    });

    it('muestra estado vacío con salida al listado cuando todas las secciones están vacías', () => {
      const fixture = TestBed.createComponent(Home);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.descubrir__estado[role="status"]')).toBeTruthy();
      expect(fixture.nativeElement.textContent).toContain(
        'Por ahora no hay sucursales para mostrar',
      );
      expect(
        fixture.nativeElement.querySelector('.descubrir__estado a').getAttribute('href'),
      ).toBe('/sucursales');
    });

    it('muestra error inline, bloquea el doble reintento y se recupera con datos', () => {
      const respuesta = new Subject<RecomendacionesSucursalesDTO>();
      recomendaciones
        .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 0 })))
        .mockReturnValue(respuesta);

      const fixture = TestBed.createComponent(Home);
      fixture.detectChanges();

      const alerta = fixture.nativeElement.querySelector('.descubrir__estado[role="alert"]');
      expect(alerta.textContent).toContain('No pudimos cargar las recomendaciones');
      const reintentar = alerta.querySelector('button') as HTMLButtonElement;
      expect(reintentar.disabled).toBe(false);

      reintentar.click();
      fixture.detectChanges();
      expect(reintentar.disabled).toBe(true);
      expect(reintentar.textContent).toContain('Reintentando');
      reintentar.click();
      expect(recomendaciones).toHaveBeenCalledTimes(2);

      respuesta.next({ ...recomendacionesVacias(), mejores: [sucursal(1, 'Mejor')] });
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.carrusel__card')).toBeTruthy();
    });
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
      expect(enlacesSucursales.some((enlace) => enlace.textContent?.includes('Ver todas'))).toBe(
        true,
      );
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
      expect(
        fixture.nativeElement.querySelector('.sucursales-destacadas__aviso').textContent,
      ).toContain('Cargando');
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
