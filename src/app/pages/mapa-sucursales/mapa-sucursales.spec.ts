import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Component } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';

import { SucursalMiniDTO } from '../../models/sucursal';
import { googleMapsService, GoogleMapsNamespace } from '../../services/google-maps-service';
import { sucursalService } from '../../services/sucursal-service';
import { SucursalMapaDTO } from './mapa-sucursales-datos';
import { MapaSucursales } from './mapa-sucursales';

@Component({ template: '' })
class EmptyPage {}

const SUCURSALES: readonly SucursalMapaDTO[] = [
  {
    id: 1,
    nombre: 'Sucursal Flores',
    categoria: 'SPA',
    fotoPerfil: null,
    puntuacion: 4.5,
    cantidadPuntuaciones: 10,
    latitud: -34.6,
    longitud: -58.3,
  },
  {
    id: 2,
    nombre: 'Sucursal Norte',
    categoria: 'BARBERIA',
    fotoPerfil: null,
    puntuacion: null,
    cantidadPuntuaciones: 0,
    latitud: -34.62,
    longitud: -58.32,
  },
  {
    id: 3,
    nombre: 'Sucursal sin ubicación',
    categoria: 'SPA',
    fotoPerfil: null,
    puntuacion: null,
    cantidadPuntuaciones: 0,
    latitud: null,
    longitud: null,
  },
] as const;

class ObservadorFalso implements IntersectionObserver {
  static ultimo: ObservadorFalso | null = null;
  readonly root = null;
  readonly rootMargin = '';
  readonly scrollMargin = '';
  readonly thresholds: readonly number[] = [];
  private disparo: IntersectionObserverCallback | null = null;

  constructor(callback: IntersectionObserverCallback) {
    this.disparo = callback;
    ObservadorFalso.ultimo = this;
  }

  observe(): void {}
  unobserve(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
  disconnect(): void {
    this.disparo = null;
  }
  revelar(): void {
    this.disparo?.(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
}

class MarcadorFalso {
  readonly titulos: string[] = [];
  mapa: unknown = null;
  listener: (() => void) | null = null;

  constructor(readonly opciones: Record<string, unknown>) {
    this.titulos.push(String(opciones['title'] ?? ''));
    this.mapa = opciones['map'] ?? null;
  }

  setPosition(posicion: unknown): void {
    this.opciones['position'] = posicion;
  }

  setMap(mapa: unknown): void {
    this.mapa = mapa;
  }

  setTitle(titulo: string): void {
    this.titulos.push(titulo);
  }

  addListener(_evento: string, manejador: () => void): { remove: () => void } {
    this.listener = manejador;
    return {
      remove: () => {
        this.listener = null;
      },
    };
  }
}

class VentanaFalsa {
  contenido: Node | string | null = null;
  abierta = false;

  setContent(contenido: Node | string): void {
    this.contenido = contenido;
  }

  open(): void {
    this.abierta = true;
  }

  close(): void {
    this.abierta = false;
  }
}

class MapaFalso {
  centros: unknown[] = [];
  limites: unknown[] = [];

  setCenter(centro: unknown): void {
    this.centros.push(centro);
  }

  fitBounds(bounds: unknown): void {
    this.limites.push(bounds);
  }
}

describe('US-MAP-06 · Mapa global de sucursales', () => {
  let fixture: ComponentFixture<MapaSucursales>;
  let host: HTMLElement;
  let router: Router;
  let listar: ReturnType<typeof vi.fn>;
  let filtrar: ReturnType<typeof vi.fn>;
  let categorias: ReturnType<typeof vi.fn>;
  let cargar: ReturnType<typeof vi.fn>;
  let mapa: MapaFalso;
  let ventana: VentanaFalsa;
  let marcadores: MarcadorFalso[];
  let apiFalsa: GoogleMapsNamespace;

  beforeEach(() => {
    mapa = new MapaFalso();
    ventana = new VentanaFalsa();
    marcadores = [];
    ObservadorFalso.ultimo = null;

    listar = vi.fn<() => Observable<SucursalMiniDTO[]>>(
      () => of(SUCURSALES as unknown as SucursalMiniDTO[]),
    );
    filtrar = vi.fn<() => Observable<SucursalMiniDTO[]>>(() => of([]));
    categorias = vi.fn<() => Observable<string[]>>(() => of(['SPA', 'BARBERIA']));

    const api = {
      maps: {
        Map: function () {
          return mapa;
        },
        Marker: function (opciones: Record<string, unknown>) {
          const marcador = new MarcadorFalso(opciones);
          marcadores.push(marcador);
          return marcador;
        },
        InfoWindow: function () {
          return ventana;
        },
        LatLng: function (lat: number, lng: number) {
          return { lat, lng };
        },
        LatLngBounds: function () {
          return {
            extend() {
              return this;
            },
            isEmpty: () => false,
          };
        },
        event: { clearInstanceListeners: vi.fn() },
      },
    } as unknown as GoogleMapsNamespace;
    apiFalsa = api;

    cargar = vi.fn<() => Promise<GoogleMapsNamespace>>(() =>
      Promise.resolve(apiFalsa),
    );

    TestBed.configureTestingModule({
      imports: [MapaSucursales],
      providers: [
        provideRouter([
          { path: 'sucursal/:id', component: EmptyPage },
          { path: 'mapa-sucursales', component: EmptyPage },
        ]),
        { provide: sucursalService, useValue: { listar, filtrar, categorias } },
        { provide: googleMapsService, useValue: { cargar } },
      ],
    });

    vi.stubGlobal('IntersectionObserver', ObservadorFalso);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  async function crear(): Promise<void> {
    fixture = TestBed.createComponent(MapaSucursales);
    host = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function revelar(): Promise<void> {
    ObservadorFalso.ultimo?.revelar();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('lee una sola vez el listado público y nunca usa el endpoint filtrado', async () => {
    await crear();
    await revelar();

    const input = host.querySelector<HTMLInputElement>('.busqueda__input')!;
    input.value = 'Flores';
    input.dispatchEvent(new Event('input'));
    const select = host.querySelector<HTMLSelectElement>('ds-select select')!;
    select.value = 'BARBERIA';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(listar).toHaveBeenCalledTimes(1);
    expect(listar).toHaveBeenCalledWith(true);
    expect(filtrar).not.toHaveBeenCalled();
  });

  it('no descarga Google Maps hasta que el lienzo se acerca al viewport', async () => {
    await crear();
    expect(cargar).not.toHaveBeenCalled();

    await revelar();
    expect(cargar).toHaveBeenCalledTimes(1);
    expect(mapa).toBeTruthy();
  });

  it('muestra solo marcadores con coordenadas válidas y los reconcilia al filtrar', async () => {
    await crear();
    await revelar();

    expect(marcadores).toHaveLength(2);
    expect(marcadores.map((marcador) => marcador.opciones['title'])).toEqual([
      'Sucursal Flores',
      'Sucursal Norte',
    ]);
    expect(mapa.limites).toHaveLength(1);

    const select = host.querySelector<HTMLSelectElement>('ds-select select')!;
    select.value = 'SPA';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(marcadores).toHaveLength(2);
    expect(marcadores[1].mapa).toBeNull();
    expect(mapa.centros).toHaveLength(1);
    expect(host.querySelector('[aria-live="polite"]')?.textContent).toContain(
      '1 sucursales con ubicación registrada',
    );
  });

  it('aplica la búsqueda por nombre con debounce sin reconstruir el mapa', async () => {
    await crear();
    await revelar();
    vi.useFakeTimers();

    const input = host.querySelector<HTMLInputElement>('.busqueda__input')!;
    input.value = 'Norte';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(ventana.abierta).toBe(false);

    await vi.advanceTimersByTimeAsync(350);
    fixture.detectChanges();

    expect(marcadores).toHaveLength(2);
    expect(marcadores[1].mapa).toBe(mapa);
    expect(marcadores[0].mapa).toBeNull();
  });

  it('ofrece Ver detalles y Cómo llegar en el InfoWindow usando las coordenadas guardadas', async () => {
    await crear();
    await revelar();
    const abrir = vi.spyOn(window, 'open').mockImplementation(() => null);

    marcadores[0].listener?.();
    fixture.detectChanges();

    const contenido = ventana.contenido as HTMLElement;
    const botones = Array.from(contenido.querySelectorAll('button'));
    expect(botones.map((boton) => boton.textContent?.trim())).toEqual([
      'Ver detalles',
      'Cómo llegar',
    ]);
    expect(contenido.textContent).toContain('Sucursal Flores');
    expect(contenido.textContent).toContain('Spa');
    expect(contenido.textContent).toContain('4.5 de 5 (10 reseñas)');

    botones[1].click();
    const destino = new URL(abrir.mock.calls[0][0] as string).searchParams.get(
      'destination',
    );
    expect(destino).toBe('-34.6,-58.3');

    botones[0].click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(router.url).toBe('/sucursal/1');
  });

  it('muestra un estado vacío accesible cuando no quedan sucursales visibles', async () => {
    listar.mockReturnValue(of([]));
    await crear();
    await revelar();

    expect(host.querySelector('.mapa__capa--vacio')).not.toBeNull();
    expect(host.querySelector('ds-empty-state')?.textContent).toContain(
      'No hay sucursales con ubicación registrada',
    );
    expect(host.querySelector('[role="status"]')).not.toBeNull();
    expect(marcadores).toHaveLength(0);
    expect(cargar).toHaveBeenCalledTimes(1);
  });

  it('muestra error inline, conserva los filtros y reintenta sin duplicar avisos', async () => {
    listar
      .mockReturnValueOnce(throwError(() => new Error('offline')))
      .mockReturnValueOnce(of(SUCURSALES as unknown as SucursalMiniDTO[]));
    await crear();

    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      'No pudimos cargar las sucursales',
    );

    const reintentar = host.querySelector<HTMLButtonElement>('ds-alert button')!;
    reintentar.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(listar).toHaveBeenCalledTimes(2);
    expect(host.querySelector('[role="alert"]')).toBeNull();
    expect(marcadores).toHaveLength(0);
  });

  it('informa un fallo del loader y permite reintentar la carga del mapa', async () => {
    cargar
      .mockRejectedValueOnce(new Error('sin-api-key'))
      .mockImplementation(() => Promise.resolve(apiFalsa));
    await crear();
    await revelar();

    expect(
      host.querySelector('.mapa__capa--error')?.textContent,
    ).toContain('No pudimos cargar el mapa');
    (host.querySelector('.mapa__capa--error button') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(cargar).toHaveBeenCalledTimes(2);
    expect(host.querySelector('.mapa__capa--error')).toBeNull();
  });
});
