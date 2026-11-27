import { HttpErrorResponse } from '@angular/common/http';
import { Component, WritableSignal, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';

import { routes } from '../../app.routes';
import { RecomendacionesSucursalesDTO, SucursalMiniDTO } from '../../models/sucursal';
import { authService } from '../../services/auth-service';
import { sucursalService } from '../../services/sucursal-service';
import { Sucursales } from '../sucursales/sucursales';
import { SucursalesDescubrimiento } from './sucursales-descubrimiento';

@Component({ template: '' })
class EmptyPage {}

const PELUQUERIA: SucursalMiniDTO = {
  id: 17,
  nombre: 'Peluquería centro',
  categoria: 'PELUQUERIA',
  fotoPerfil: null,
  puntuacion: 4.5,
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

function sucursal(id: number, nombre: string): SucursalMiniDTO {
  return { ...PELUQUERIA, id, nombre };
}

describe('SucursalesDescubrimiento: pantalla principal de sucursales (SCRUM-364)', () => {
  let router: Router;
  let recomendaciones: ReturnType<typeof vi.fn>;
  let filtrar: ReturnType<typeof vi.fn>;
  let autenticado: WritableSignal<boolean>;

  beforeEach(() => {
    autenticado = signal(true);
    recomendaciones = vi.fn<
      () => Observable<RecomendacionesSucursalesDTO>
    >(() => of(recomendacionesVacias()));
    filtrar = vi.fn<
      (categoria?: string | null, nombre?: string | null, silenciar?: boolean) => Observable<SucursalMiniDTO[]>
    >(() => of([]));

    TestBed.configureTestingModule({
      imports: [SucursalesDescubrimiento],
      providers: [
        provideRouter([
          { path: 'listado-sucursales', component: EmptyPage },
          { path: 'sucursal/:id', component: EmptyPage },
        ]),
        { provide: sucursalService, useValue: { recomendaciones, filtrar } },
        { provide: authService, useValue: { autenticado } },
      ],
    });
    router = TestBed.inject(Router);
  });

  afterEach(() => vi.useRealTimers());

  it('ofrece buscador, pero no selector de categorías ni filtros', () => {
    const fixture = TestBed.createComponent(SucursalesDescubrimiento);
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;

    expect(raiz.querySelector('form[role="search"]')).toBeTruthy();
    expect(raiz.querySelector('input[role="combobox"]')).toBeTruthy();
    expect(raiz.querySelector('select, .categoria-chip, [aria-label="Filtrar por categoría"]')).toBeNull();
    expect(filtrar).not.toHaveBeenCalled();
    expect(recomendaciones).toHaveBeenCalledOnce();
  });

  it('no repite la etiqueta del buscador y conserva el placeholder', () => {
    const fixture = TestBed.createComponent(SucursalesDescubrimiento);
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;
    const input = raiz.querySelector('#branch-search') as HTMLInputElement;

    expect(raiz.textContent).not.toContain('Buscar sucursal por nombre');
    expect(raiz.querySelectorAll('label')).toHaveLength(0);
    expect(input.getAttribute('aria-label')).toBe('Buscar sucursal por nombre');
    expect(input.placeholder).toBe('Nombre de la sucursal...');
  });

  it('muestra sólo las secciones públicas a un visitante, aunque lleguen datos personales', () => {
    autenticado.set(false);
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

    const fixture = TestBed.createComponent(SucursalesDescubrimiento);
    fixture.detectChanges();
    const titulos = Array.from(
      fixture.nativeElement.querySelectorAll('.carrusel__titulo'),
    ) as HTMLElement[];

    expect(titulos.map((titulo) => titulo.textContent?.trim())).toEqual([
      'Las mejores de AppointMee',
      'Las más demandadas',
      'Nuevas en AppointMee',
      'Todas las sucursales',
    ]);
    expect(fixture.nativeElement.textContent).not.toContain('Visto recientemente');
    expect(fixture.nativeElement.textContent).not.toContain('Recomendado para vos');
    expect(fixture.nativeElement.querySelector('.descubrir__boton-ver-todas')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('form[role="search"]')).toBeTruthy();
  });

  it('mantiene las secciones personales para el usuario autenticado con resultados', () => {
    autenticado.set(true);
    recomendaciones.mockReturnValue(
      of({
        ...recomendacionesVacias(),
        vistasRecientes: [sucursal(4, 'Visitada')],
        paraVos: [sucursal(5, 'Para vos')],
      }),
    );

    const fixture = TestBed.createComponent(SucursalesDescubrimiento);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Visto recientemente');
    expect(fixture.nativeElement.textContent).toContain('Recomendado para vos');
  });

  it('no muestra un contador ni un mensaje técnico de secciones disponibles', () => {
    recomendaciones.mockReturnValue(
      of({ ...recomendacionesVacias(), mejores: [sucursal(1, 'Mejor')] }),
    );

    const fixture = TestBed.createComponent(SucursalesDescubrimiento);
    fixture.detectChanges();
    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(texto).not.toMatch(/\d+\s+secciones/i);
    expect(texto).not.toContain('secciones de sucursales disponibles');
  });

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

    const fixture = TestBed.createComponent(SucursalesDescubrimiento);
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
  });

  it('oculta las secciones vacías y destaca «Ver todas» hacia el listado completo', () => {
    recomendaciones.mockReturnValue(
      of({
        ...recomendacionesVacias(),
        mejores: [sucursal(1, 'Mejor')],
        todas: [sucursal(6, 'Todas')],
      }),
    );

    const fixture = TestBed.createComponent(SucursalesDescubrimiento);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.carrusel')).toHaveLength(2);
    expect(fixture.nativeElement.textContent).not.toContain('Visto recientemente');
    expect(fixture.nativeElement.querySelector('.carrusel__ver-todas')).toBeNull();

    const boton = fixture.nativeElement.querySelector('.descubrir__boton-ver-todas');
    expect(boton.getAttribute('href')).toBe('/listado-sucursales');
    expect(boton.textContent).toContain('Ver todas las sucursales');
    expect(boton.classList.contains('ds-btn--primary')).toBe(true);
    expect(
      fixture.nativeElement.querySelector('.descubrir__ver-todas-copy').textContent,
    ).toContain('todas las sucursales');
  });

  it('muestra skeletons accesibles mientras cargan las recomendaciones', () => {
    recomendaciones.mockReturnValue(new Subject<RecomendacionesSucursalesDTO>());

    const fixture = TestBed.createComponent(SucursalesDescubrimiento);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.descubrir__skeleton[aria-busy="true"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelectorAll('.descubrir__skeleton-card')).toHaveLength(8);
    expect((fixture.nativeElement as HTMLElement).textContent).not.toMatch(/\d+\s+secciones/i);
  });

  it('muestra estado vacío con salida al listado completo cuando no hay secciones', () => {
    const fixture = TestBed.createComponent(SucursalesDescubrimiento);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.descubrir__estado[role="status"]')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain(
      'Por ahora no hay sucursales para mostrar',
    );
    expect(
      fixture.nativeElement.querySelector('.descubrir__estado a').getAttribute('href'),
    ).toBe('/listado-sucursales');
  });

  it('muestra error inline, bloquea el doble reintento y se recupera con datos', () => {
    const respuesta = new Subject<RecomendacionesSucursalesDTO>();
    recomendaciones
      .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 0 })))
      .mockReturnValue(respuesta);

    const fixture = TestBed.createComponent(SucursalesDescubrimiento);
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

  it('espera dos caracteres y desbota las sugerencias 350 ms reutilizando el servicio', async () => {
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(SucursalesDescubrimiento);
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
    expect(filtrar).toHaveBeenCalledWith(null, 'pe', true);
  });

  it('conserva sólo la respuesta más reciente al cambiar el término', async () => {
    vi.useFakeTimers();
    const primera = new Subject<SucursalMiniDTO[]>();
    const segunda = new Subject<SucursalMiniDTO[]>();
    filtrar.mockReturnValueOnce(primera).mockReturnValueOnce(segunda);

    const fixture = TestBed.createComponent(SucursalesDescubrimiento);
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('#branch-search') as HTMLInputElement;

    input.focus();
    input.value = 'pelu';
    input.dispatchEvent(new Event('input'));
    await vi.advanceTimersByTimeAsync(350);
    input.value = 'peluquería';
    input.dispatchEvent(new Event('input'));
    await vi.advanceTimersByTimeAsync(350);

    segunda.next([PELUQUERIA]);
    fixture.detectChanges();
    primera.next([]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(PELUQUERIA.nombre);
  });

  it('navega al detalle al seleccionar una sugerencia con el mouse', async () => {
    vi.useFakeTimers();
    filtrar.mockReturnValue(of([PELUQUERIA]));

    const fixture = TestBed.createComponent(SucursalesDescubrimiento);
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('#branch-search') as HTMLInputElement;
    input.focus();
    input.value = 'pelu';
    input.dispatchEvent(new Event('input'));
    await vi.advanceTimersByTimeAsync(350);
    fixture.detectChanges();

    const opcion = fixture.nativeElement.querySelector('.branch-suggestion') as HTMLButtonElement;
    expect(opcion.getAttribute('role')).toBe('option');
    opcion.click();

    await vi.waitFor(() => expect(router.url).toBe('/sucursal/17'));
  });

  it('presionar Enter lleva al listado con el término como filtro de nombre', async () => {
    const fixture = TestBed.createComponent(SucursalesDescubrimiento);
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('#branch-search') as HTMLInputElement;
    const form = fixture.nativeElement.querySelector('.branch-search') as HTMLFormElement;

    input.value = '  pelu  ';
    input.dispatchEvent(new Event('input'));
    form.dispatchEvent(new Event('submit'));

    await vi.waitFor(() => expect(router.url).toBe('/listado-sucursales?busqueda=pelu'));
  });

  it('Enter con una sola coincidencia tampoco salta al detalle sin selección explícita', async () => {
    vi.useFakeTimers();
    filtrar.mockReturnValue(of([PELUQUERIA]));

    const fixture = TestBed.createComponent(SucursalesDescubrimiento);
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('#branch-search') as HTMLInputElement;
    input.focus();
    input.value = 'pelu';
    input.dispatchEvent(new Event('input'));
    await vi.advanceTimersByTimeAsync(350);
    fixture.detectChanges();

    fixture.nativeElement.querySelector('.branch-search').dispatchEvent(new Event('submit'));
    await vi.waitFor(() => expect(router.url).toBe('/listado-sucursales?busqueda=pelu'));
  });

  it('permite elegir una sugerencia concreta con flechas y Enter', async () => {
    vi.useFakeTimers();
    filtrar.mockReturnValue(of([PELUQUERIA, sucursal(18, 'Peluquería norte')]));

    const fixture = TestBed.createComponent(SucursalesDescubrimiento);
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('#branch-search') as HTMLInputElement;
    input.focus();
    input.value = 'pelu';
    input.dispatchEvent(new Event('input'));
    await vi.advanceTimersByTimeAsync(350);
    fixture.detectChanges();

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    fixture.detectChanges();
    expect(input.getAttribute('aria-activedescendant')).toBe('branch-suggestion-1');

    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    input.dispatchEvent(enter);
    expect(enter.defaultPrevented).toBe(true);
    await vi.waitFor(() => expect(router.url).toBe('/sucursal/18'));
  });

  it('muestra ausencia de coincidencias con salida a la búsqueda general', async () => {
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(SucursalesDescubrimiento);
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('#branch-search') as HTMLInputElement;
    input.focus();
    input.value = 'inexistente';
    input.dispatchEvent(new Event('input'));
    await vi.advanceTimersByTimeAsync(350);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.branch-suggestions__state').textContent).toContain(
      'No se encontraron coincidencias',
    );
    expect(fixture.nativeElement.textContent).toContain('listado completo');
  });

  it('muestra error inline de sugerencias sin romper el descubrimiento', async () => {
    vi.useFakeTimers();
    filtrar.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));

    const fixture = TestBed.createComponent(SucursalesDescubrimiento);
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('#branch-search') as HTMLInputElement;
    input.focus();
    input.value = 'pelu';
    input.dispatchEvent(new Event('input'));
    await vi.advanceTimersByTimeAsync(350);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('.branch-suggestions__state--error[role="alert"]')
        .textContent,
    ).toContain('No pudimos cargar las sugerencias');
  });

  it('avisa el término demasiado corto y cierra las sugerencias con Escape', async () => {
    vi.useFakeTimers();
    filtrar.mockReturnValue(of([PELUQUERIA]));

    const fixture = TestBed.createComponent(SucursalesDescubrimiento);
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('#branch-search') as HTMLInputElement;
    input.focus();
    input.value = 'p';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const hint = fixture.nativeElement.querySelector('#branch-search-hint');
    expect(hint.textContent).toContain('al menos 2 caracteres');
    expect(input.getAttribute('aria-describedby')).toBe('branch-search-hint');

    input.value = 'pelu';
    input.dispatchEvent(new Event('input'));
    await vi.advanceTimersByTimeAsync(350);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.branch-suggestions')).toBeTruthy();

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.branch-suggestions')).toBeNull();
  });

  it('limpia el buscador desde el botón de limpiar', async () => {
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(SucursalesDescubrimiento);
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('#branch-search') as HTMLInputElement;
    input.value = 'pelu';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('.branch-search__clear') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(input.value).toBe('');
    expect(fixture.nativeElement.querySelector('.branch-search__clear')).toBeNull();
  });

  it('conecta /sucursales con el descubrimiento y /listado-sucursales con el listado', async () => {
    const descubrimiento = routes.find((ruta) => ruta.path === 'sucursales');
    const listado = routes.find((ruta) => ruta.path === 'listado-sucursales');

    expect(descubrimiento).toBeDefined();
    expect(listado).toBeDefined();
    const cargarDescubrimiento = descubrimiento?.loadComponent as () => Promise<unknown>;
    const cargarListado = listado?.loadComponent as () => Promise<unknown>;

    await expect(cargarDescubrimiento()).resolves.toBe(SucursalesDescubrimiento);
    await expect(cargarListado()).resolves.toBe(Sucursales);
  });
});
