import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';

import { SucursalMiniDTO } from '../../models/sucursal';
import {
  googleMapsService,
  GoogleMapsNamespace,
} from '../../services/google-maps-service';
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
    fotoPerfil: 'https://ejemplo.test/flores.jpg',
    puntuacion: 4.5,
    cantidadPuntuaciones: 10,
    diasApertura: ['MONDAY', 'WEDNESDAY', 'SUNDAY'],
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
    diasApertura: ['SATURDAY'],
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
  readonly iconos: string[] = [];
  mapa: unknown = null;
  listener: (() => void) | null = null;

  constructor(readonly opciones: Record<string, unknown>) {
    this.iconos.push(String(opciones['icon'] ?? ''));
    this.mapa = opciones['map'] ?? null;
  }

  setPosition(posicion: unknown): void {
    this.opciones['position'] = posicion;
  }

  setIcon(url: string): void {
    this.iconos.push(url);
  }

  setMap(mapa: unknown): void {
    this.mapa = mapa;
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

  async function buscar(valor: string): Promise<void> {
    vi.useFakeTimers();
    const input = host.querySelector<HTMLInputElement>('.busqueda__input')!;
    input.value = valor;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(350);
    fixture.detectChanges();
  }

  it('lee una sola vez el listado público y nunca usa el endpoint filtrado', async () => {
    await crear();
    await revelar();

    await buscar('Flores');
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

  it('muestra solo indicadores con coordenadas válidas y los reconcilia al filtrar', async () => {
    await crear();
    await revelar();

    expect(marcadores).toHaveLength(2);
    expect(marcadores.every((marcador) => decodeURIComponent(marcador.iconos[0]).includes('fill="#f7c65a"'))).toBe(true);
    expect(decodeURIComponent(marcadores[0].iconos[0])).toContain('>4.5<');
    expect(decodeURIComponent(marcadores[1].iconos[0])).not.toMatch(/>[\d.]+</);
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

    await buscar('Norte');

    expect(marcadores).toHaveLength(2);
    expect(marcadores[1].mapa).toBe(mapa);
    expect(marcadores[0].mapa).toBeNull();
  });

  it('busca solo por nombre: un ID no encuentra la sucursal', async () => {
    await crear();
    await revelar();

    await buscar('20');

    expect(marcadores.every((marcador) => marcador.mapa === null)).toBe(true);
    expect(host.querySelector('.mapa__capa--vacio')).not.toBeNull();
  });

  it('combina búsqueda por nombre y categoría', async () => {
    await crear();
    await revelar();

    await buscar('Flores');
    expect(marcadores[0].mapa).toBe(mapa);

    const select = host.querySelector<HTMLSelectElement>('ds-select select')!;
    select.value = 'BARBERIA';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(marcadores.every((marcador) => marcador.mapa === null)).toBe(true);

    select.value = 'SPA';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(marcadores.at(-1)?.mapa).toBe(mapa);
    expect(marcadores.at(-2)?.mapa).toBeNull();
  });

  it('muestra todos los datos, abejas, cantidad y días en el InfoWindow', async () => {
    await crear();
    await revelar();

    marcadores[0].listener?.();
    fixture.detectChanges();

    const contenido = ventana.contenido as HTMLElement;
    const botones = Array.from(contenido.querySelectorAll('button'));
    const foto = contenido.querySelector('img')!;
    const abejas = Array.from(contenido.querySelectorAll('span')).filter(
      (span) => span.textContent === '🐝',
    );
    const dias = Array.from(contenido.querySelectorAll('div'))
      .flatMap((div) => Array.from(div.children))
      .filter((hijo) => /^(LU|MA|MI|JU|VI|SA|DO)$/.test(hijo.textContent ?? ''));

    expect(botones.map((boton) => boton.textContent?.trim())).toEqual([
      'Ver detalles',
      'Cómo llegar',
    ]);
    expect(foto.getAttribute('src')).toBe('https://ejemplo.test/flores.jpg');
    expect(foto.alt).toBe('Foto de Sucursal Flores');
    expect(contenido.textContent).toContain('Sucursal Flores');
    expect(contenido.textContent).toContain('Spa');
    expect(abejas).toHaveLength(5);
    expect(contenido.textContent).toContain('4.5 / 5 · 10 puntuaciones');
    expect(contenido.textContent).toContain('LU · MA · MI · JU · VI · SA · DO');
    expect(dias.map((dia) => dia.textContent)).toEqual([
      'LU', 'MA', 'MI', 'JU', 'VI', 'SA', 'DO',
    ]);
    expect(dias[0].getAttribute('style')).toContain('var(--accent)');
    expect(dias[1].getAttribute('style')).toContain('line-through');
    expect(contenido.querySelector('[aria-label*="abiertos LU"]')).not.toBeNull();
  });

  it('respeta el estado sin puntuaciones al seleccionar una sucursal sin reseñas', async () => {
    await crear();
    await revelar();

    marcadores[1].listener?.();
    fixture.detectChanges();

    const contenido = ventana.contenido as HTMLElement;
    expect(contenido.textContent).toContain('Sin puntuaciones');
    expect(contenido.textContent).not.toContain('🐝');
    expect(contenido.querySelector('img')?.alt).toBe('Sin imagen');
    expect(contenido.textContent).toContain('SA');
  });

  it('abre Ver detalles y Cómo llegar con las coordenadas guardadas', async () => {
    await crear();
    await revelar();
    const abrir = vi.spyOn(window, 'open').mockImplementation(() => null);

    marcadores[0].listener?.();
    fixture.detectChanges();
    const botones = Array.from(
      (ventana.contenido as HTMLElement).querySelectorAll('button'),
    );

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
