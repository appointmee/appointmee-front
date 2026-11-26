import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';

import { SucursalMiniDTO } from '../../models/sucursal';
import {
  ErrorGeolocalizacion,
  PosicionCliente,
  geolocalizacionService,
} from '../../services/geolocalizacion-service';
import {
  googleMapsService,
  GoogleMapsNamespace,
} from '../../services/google-maps-service';
import { sucursalService } from '../../services/sucursal-service';
import { SucursalMapaDTO } from './mapa-sucursales-datos';
import { MapaSucursales } from './mapa-sucursales';

@Component({ template: '' })
class EmptyPage {}

const MENSAJE_UBICACION =
  '¡Compartí tu ubicación! Si aceptás, aparecerás en el mapa como una abeja para que puedas identificar fácilmente dónde estás respecto a las sucursales. Tu ubicación no se guardará ni se enviará al servidor';

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
  marco: HTMLElement | null = null;

  setContent(contenido: Node | string): void {
    this.contenido = contenido;
  }

  open(): void {
    this.abierta = true;
    if (!(this.contenido instanceof Node)) {
      return;
    }
    const documento = this.contenido.ownerDocument;
    if (!documento) {
      return;
    }
    const marco = documento.createElement('div');
    marco.className = 'gm-style-iw';
    const puntero = documento.createElement('div');
    puntero.className = 'gm-style-iw-t';
    const tarjeta = documento.createElement('div');
    tarjeta.className = 'gm-style-iw-c';
    const cuerpo = documento.createElement('div');
    cuerpo.className = 'gm-style-iw-d';
    cuerpo.append(this.contenido);
    tarjeta.append(cuerpo);
    marco.append(puntero, tarjeta);
    documento.body.append(marco);
    this.marco = marco;
  }

  close(): void {
    this.abierta = false;
    this.marco?.remove();
    this.marco = null;
  }
}

class MapaFalso {
  centros: unknown[] = [];
  limites: unknown[] = [];
  listenerMapa: (() => void) | null = null;

  setCenter(centro: unknown): void {
    this.centros.push(centro);
  }

  fitBounds(bounds: unknown): void {
    this.limites.push(bounds);
  }

  addListener(_evento: string, manejador: () => void): { remove: () => void } {
    this.listenerMapa = manejador;
    return {
      remove: () => {
        this.listenerMapa = null;
      },
    };
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
  let obtenerPosicion: ReturnType<typeof vi.fn>;
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
    obtenerPosicion = vi.fn<() => Promise<PosicionCliente>>(() =>
      Promise.resolve({ lat: -34.55, lng: -58.4 }),
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
        { provide: geolocalizacionService, useValue: { obtenerPosicion } },
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

  function botonCompartir(): HTMLButtonElement | null {
    return host.querySelector<HTMLButtonElement>('.mapa__compartir-ubicacion');
  }

  function dialogo(): HTMLElement | null {
    return host.querySelector<HTMLElement>('ds-modal .ds-modal');
  }

  function abrirDialogo(): void {
    botonCompartir()!.click();
    fixture.detectChanges();
  }

  function accionDialogo(indice: number): void {
    dialogo()!.querySelectorAll<HTMLButtonElement>('button')[indice].click();
    fixture.detectChanges();
  }

  async function confirmarUbicacion(): Promise<void> {
    abrirDialogo();
    accionDialogo(1);
    await fixture.whenStable();
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
    expect(decodeURIComponent(marcadores[0].iconos[0])).toContain('width="62"');
    expect(decodeURIComponent(marcadores[0].iconos[0])).toContain('>4.5</tspan>');
    expect(decodeURIComponent(marcadores[0].iconos[0])).toContain('🐝');
    expect(decodeURIComponent(marcadores[1].iconos[0])).toContain('width="44"');
    expect(decodeURIComponent(marcadores[1].iconos[0])).toContain('>-<');
    expect(decodeURIComponent(marcadores[1].iconos[0])).toContain('🐝');
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

  it('quita el marco blanco de Google y deja solo el panel negro', async () => {
    await crear();
    await revelar();

    marcadores[0].listener?.();
    const marco = ventana.marco!;
    const tarjeta = marco.querySelector<HTMLElement>('.gm-style-iw-c')!;
    const cuerpo = marco.querySelector<HTMLElement>('.gm-style-iw-d')!;
    const puntero = marco.querySelector<HTMLElement>('.gm-style-iw-t')!;
    const panel = ventana.contenido as HTMLElement;

    expect(panel.textContent).toContain('Sucursal Flores');
    expect(tarjeta.getAttribute('style')).not.toMatch(/background(-color)?:\s*(white|#fff)/i);
    expect(tarjeta.getAttribute('style')).toContain('background: transparent');
    expect(tarjeta.getAttribute('style')).toContain('box-shadow: none');
    expect(tarjeta.getAttribute('style')).toContain('padding: 0');
    expect(cuerpo.getAttribute('style')).toContain('overflow: visible');
    expect(puntero.style.display).toBe('none');
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

  it('cierra la ventana y desactiva sus acciones al hacer clic fuera de un indicador', async () => {
    await crear();
    await revelar();

    marcadores[0].listener?.();
    const contenido = ventana.contenido as HTMLElement;
    expect(ventana.abierta).toBe(true);

    mapa.listenerMapa?.();
    expect(ventana.abierta).toBe(false);

    contenido.querySelector<HTMLButtonElement>('button')?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(router.url).not.toBe('/sucursal/1');
  });

  it('reemplaza la selección al elegir otro indicador conservando sus acciones', async () => {
    await crear();
    await revelar();

    marcadores[0].listener?.();
    const anterior = ventana.contenido as HTMLElement;
    expect(anterior.textContent).toContain('Sucursal Flores');

    marcadores[1].listener?.();
    const actual = ventana.contenido as HTMLElement;
    expect(ventana.abierta).toBe(true);
    expect(actual).not.toBe(anterior);
    expect(actual.textContent).toContain('Sucursal Norte');
    expect(anterior.textContent).not.toContain('Sucursal Norte');

    actual.querySelector<HTMLButtonElement>('button')?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(router.url).toBe('/sucursal/2');
  });

  it('cierra la ventana al cambiar la categoría o la búsqueda', async () => {
    await crear();
    await revelar();

    marcadores[0].listener?.();
    expect(ventana.abierta).toBe(true);

    const select = host.querySelector<HTMLSelectElement>('ds-select select')!;
    select.value = 'BARBERIA';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(ventana.abierta).toBe(false);

    select.value = 'SPA';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    marcadores.at(-1)?.listener?.();
    expect(ventana.abierta).toBe(true);

    await buscar('Norte');
    expect(ventana.abierta).toBe(false);
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

  it('muestra el botón en el mapa y cancelar no pide la ubicación', async () => {
    await crear();

    const boton = botonCompartir();
    expect(boton).not.toBeNull();
    expect(boton!.textContent?.trim()).toBe('Compartir ubicación');
    expect(boton!.disabled).toBe(true);
    boton!.click();
    fixture.detectChanges();
    expect(dialogo()).toBeNull();
    expect(obtenerPosicion).not.toHaveBeenCalled();

    await revelar();
    expect(botonCompartir()!.disabled).toBe(false);
    abrirDialogo();

    expect(dialogo()?.textContent).toContain(MENSAJE_UBICACION);
    expect(
      Array.from(dialogo()!.querySelectorAll('button')).map((accion) =>
        accion.textContent?.trim(),
      ),
    ).toEqual(['Cancelar', 'Aceptar']);
    expect(obtenerPosicion).not.toHaveBeenCalled();

    accionDialogo(0);
    expect(dialogo()).toBeNull();
    expect(obtenerPosicion).not.toHaveBeenCalled();
    expect(botonCompartir()).not.toBeNull();
    expect(marcadores).toHaveLength(2);

    const select = host.querySelector<HTMLSelectElement>('ds-select select')!;
    select.value = 'SPA';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(marcadores).toHaveLength(2);
    expect(marcadores[1].mapa).toBeNull();
  });

  it('cierra el cuadro de confirmación desde el fondo sin solicitar permiso', async () => {
    await crear();
    await revelar();
    abrirDialogo();

    host.querySelector<HTMLElement>('.ds-modal-backdrop')!.click();
    fixture.detectChanges();

    expect(dialogo()).toBeNull();
    expect(obtenerPosicion).not.toHaveBeenCalled();
    expect(botonCompartir()).not.toBeNull();
  });

  it('dibuja la abeja del cliente, centra el mapa, conserva sucursales y oculta el botón', async () => {
    await crear();
    await revelar();
    await confirmarUbicacion();

    expect(obtenerPosicion).toHaveBeenCalledTimes(1);
    expect(marcadores).toHaveLength(3);
    expect(marcadores[0].mapa).toBe(mapa);
    expect(marcadores[1].mapa).toBe(mapa);

    const cliente = marcadores[2];
    expect(cliente.opciones['map']).toBe(mapa);
    expect(cliente.opciones['title']).toBe('Tu ubicación');
    expect(cliente.opciones['zIndex']).toBe(1000);
    const svg = decodeURIComponent(String(cliente.opciones['icon']));
    expect(svg).toContain('width="88"');
    expect(svg).toContain('🐝');
    expect(svg).toContain('>VOS<');
    expect(mapa.centros.at(-1)).toEqual({ lat: -34.55, lng: -58.4 });
    expect(botonCompartir()).toBeNull();
    expect(host.querySelector('[role="alert"]')).toBeNull();

    await buscar('Norte');
    expect(marcadores[0].mapa).toBeNull();
    expect(marcadores[1].mapa).toBe(mapa);
    expect(cliente.mapa).toBe(mapa);
  });

  it('muestra carga, bloquea solicitudes simultáneas y oculta el botón solo al éxito', async () => {
    let resolver!: (posicion: PosicionCliente) => void;
    obtenerPosicion.mockReturnValue(
      new Promise<PosicionCliente>((resolve) => {
        resolver = resolve;
      }),
    );
    await crear();
    await revelar();
    abrirDialogo();
    accionDialogo(1);
    fixture.detectChanges();

    const boton = botonCompartir()!;
    expect(obtenerPosicion).toHaveBeenCalledTimes(1);
    expect(boton.disabled).toBe(true);
    expect(boton.getAttribute('aria-busy')).toBe('true');
    expect(host.querySelector('.mapa__estado--ubicacion')?.textContent).toContain(
      'Obteniendo tu ubicación',
    );
    expect(botonCompartir()).not.toBeNull();

    (
      fixture.componentInstance as unknown as {
        obtenerUbicacion: () => Promise<void>;
      }
    ).obtenerUbicacion();
    expect(obtenerPosicion).toHaveBeenCalledTimes(1);

    resolver({ lat: -34.55, lng: -58.4 });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(botonCompartir()).toBeNull();
    expect(host.querySelector('.mapa__estado--ubicacion')).toBeNull();
  });

  it('no dibuja marcador al denegar permiso y permite reintentar', async () => {
    obtenerPosicion
      .mockRejectedValueOnce(new ErrorGeolocalizacion('denegado'))
      .mockResolvedValueOnce({ lat: -34.55, lng: -58.4 });
    await crear();
    await revelar();
    await confirmarUbicacion();

    expect(obtenerPosicion).toHaveBeenCalledTimes(1);
    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      'no diste permiso',
    );
    expect(marcadores).toHaveLength(2);
    expect(botonCompartir()).not.toBeNull();

    const reintentar = host.querySelector<HTMLButtonElement>('ds-alert button')!;
    reintentar.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(obtenerPosicion).toHaveBeenCalledTimes(2);
    expect(host.querySelector('[role="alert"]')).toBeNull();
    expect(marcadores).toHaveLength(3);
    expect(botonCompartir()).toBeNull();
  });

  it('informa sin soporte, timeout y error genérico en español con reintento', async () => {
    const casos = [
      { tipo: 'sin-soporte', texto: 'no permite compartir' },
      { tipo: 'timeout', texto: 'Se agotó el tiempo' },
      { tipo: 'error', texto: 'No pudimos obtener tu ubicación' },
    ] as const;

    await crear();
    await revelar();

    for (const [indice, caso] of casos.entries()) {
      obtenerPosicion.mockRejectedValueOnce(
        new ErrorGeolocalizacion(caso.tipo),
      );
      if (indice === 0) {
        await confirmarUbicacion();
      } else {
        host.querySelector<HTMLButtonElement>('ds-alert button')!.click();
        await fixture.whenStable();
        fixture.detectChanges();
      }

      expect(host.querySelector('[role="alert"]')?.textContent).toContain(
        caso.texto,
      );
      expect(marcadores).toHaveLength(2);
      expect(botonCompartir()).not.toBeNull();
    }

    expect(obtenerPosicion).toHaveBeenCalledTimes(3);
  });
});
