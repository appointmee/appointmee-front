import { DOCUMENT } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';

import { googleMapsService } from '../../services/google-maps-service';
import { sucursalService } from '../../services/sucursal-service';
import { DsButtonComponent } from '../../shared/ui/button/button.component';
import {
  DsAlertComponent,
  DsEmptyStateComponent,
  DsSelectComponent,
  DsSkeletonComponent,
} from '../../shared/ui/misc/misc.component';
import { DsInputComponent } from '../../shared/ui/input/input.component';
import {
  DEBOUNCE_BUSQUEDA_MS,
  MIN_CARACTERES_BUSQUEDA,
  normalizarTerminoBusqueda,
} from '../../shared/busqueda-sucursales';
import {
  SucursalMapaDTO,
  abejasMapa,
  coordenadasValidas,
  diasMapa,
  filtrarSucursalesMapa,
  humanizarCategoria,
  iconoIndicadorMapa,
  puntuacionMapa,
  terminoDeBusquedaMapa,
  textoIndicadorMapa,
  urlCómoLlegar,
} from './mapa-sucursales-datos';
import {
  GoogleMapsApi,
  MotorMapaSucursales,
} from './mapa-sucursales-motor';

/** Centro fijo de Argentina: no implica ninguna consulta de geolocalización. */
const CENTRO_INICIAL = { lat: -34.6037, lng: -58.3816 };
const ZOOM_INICIAL = 5;

/** Mismo reemplazo que usa el detalle de sucursal cuando no hay foto. */
const IMAGEN_SIN_FOTO = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400"><rect width="640" height="400" fill="#0d1117"/><g fill="none" stroke="#98a2b3" stroke-width="3"><rect x="220" y="110" width="200" height="150" rx="16"/><circle cx="280" cy="160" r="20"/><path d="220 230l55-50 40 34 35-28 70 60"/></g><text x="320" y="310" text-anchor="middle" fill="#98a2b3" font-size="18" font-family="sans-serif">Sin imagen</text></svg>',
)}`;

/**
 * US-MAP-06 · Mapa global y público de sucursales.
 *
 * Una sola lectura de `/sucursales/listar` alimenta la página; los filtros son
 * locales, por nombre y categoría, y nunca vuelven a consultar el backend. La
 * Maps JavaScript API se carga con el loader centralizado únicamente cuando el
 * lienzo se acerca al viewport, y los indicadores se reconcilian sin
 * reconstruir el mapa.
 */
@Component({
  selector: 'app-mapa-sucursales',
  imports: [
    DsAlertComponent,
    DsButtonComponent,
    DsEmptyStateComponent,
    DsInputComponent,
    DsSelectComponent,
    DsSkeletonComponent,
  ],
  templateUrl: './mapa-sucursales.html',
  styleUrl: './mapa-sucursales.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapaSucursales implements AfterViewInit {
  private readonly service = inject(sucursalService);
  private readonly googleMaps = inject(googleMapsService);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly lienzo = viewChild<ElementRef<HTMLElement>>('lienzo');
  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  protected readonly busqueda = signal('');
  protected readonly categoria = signal<string | null>(null);
  protected readonly terminoAplicado = signal('');
  protected readonly sucursales = signal<SucursalMapaDTO[]>([]);
  private readonly categoriasServicio = signal<string[]>([]);

  protected readonly cargandoDatos = signal(true);
  protected readonly errorDatos = signal<string | null>(null);
  protected readonly reintentandoDatos = signal(false);
  protected readonly avisoCategorias = signal<string | null>(null);

  protected readonly cargandoMapa = signal(false);
  protected readonly errorMapa = signal<string | null>(null);
  protected readonly mapaListo = signal(false);
  private readonly motor = signal<MotorMapaSucursales | null>(null);

  protected readonly categorias = computed(() => {
    const delServicio = this.categoriasServicio();
    if (delServicio.length > 0) {
      return delServicio;
    }
    return Array.from(
      new Set(this.sucursales().map((sucursal) => sucursal.categoria)),
    )
      .filter((categoria): categoria is string => !!categoria)
      .sort((a, b) => a.localeCompare(b, 'es'));
  });

  protected readonly terminoMuyCorto = computed(() => {
    const termino = normalizarTerminoBusqueda(this.busqueda());
    return termino.length > 0 && termino.length < MIN_CARACTERES_BUSQUEDA;
  });

  private readonly filtradas = computed(() =>
    filtrarSucursalesMapa(
      this.sucursales(),
      this.terminoAplicado(),
      this.categoria(),
    ),
  );

  /** Solo entran al mapa las sucursales con coordenadas válidas. */
  protected readonly visibles = computed(() =>
    this.filtradas().filter((sucursal) => coordenadasValidas(sucursal) !== null),
  );

  protected readonly sinResultados = computed(
    () =>
      !this.cargandoDatos() &&
      !this.errorDatos() &&
      this.visibles().length === 0,
  );

  protected readonly cadenaVacia =
    'No hay sucursales con ubicación registrada para estos filtros.';

  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private observer?: IntersectionObserver;
  private inicioSolicitado = false;
  private destruido = false;
  private removeresVentana: Array<() => void> = [];

  constructor() {
    this.cargarDatos();

    this.service
      .categorias()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (categorias) => this.categoriasServicio.set(categorias ?? []),
        error: () =>
          this.avisoCategorias.set(
            'No pudimos cargar todas las categorías. Podés usar las que aparecen en el mapa.',
          ),
      });

    effect(() => {
      const motor = this.motor();
      if (!motor) {
        return;
      }
      motor.actualizar(
        this.visibles(),
        (sucursal) => this.crearContenidoVentana(sucursal),
        (sucursal) => this.iconoIndicador(sucursal),
      );
    });

    this.destroyRef.onDestroy(() => {
      this.destruido = true;
      this.cancelarDebounce();
      this.observer?.disconnect();
      this.limpiarContenidoVentana();
      this.motor()?.destruir();
    });
  }

  ngAfterViewInit(): void {
    const elemento = this.lienzo()?.nativeElement;
    if (!elemento) {
      return;
    }

    if (typeof IntersectionObserver === 'undefined') {
      void this.inicializarMapa(elemento);
      return;
    }

    this.observer = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((entrada) => entrada.isIntersecting)) {
          this.observer?.disconnect();
          void this.inicializarMapa(elemento);
        }
      },
      { rootMargin: '150px' },
    );
    this.observer.observe(elemento);
  }

  protected onSearchInput(event: Event): void {
    const valor = (event.target as HTMLInputElement).value;
    this.busqueda.set(valor);
    this.cancelarDebounce();

    if (!normalizarTerminoBusqueda(valor)) {
      this.terminoAplicado.set('');
      return;
    }
    if (this.terminoMuyCorto()) {
      return;
    }

    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.terminoAplicado.set(terminoDeBusquedaMapa(valor));
    }, DEBOUNCE_BUSQUEDA_MS);
  }

  protected onSearchSubmit(event: Event): void {
    event.preventDefault();
    this.cancelarDebounce();
    this.terminoAplicado.set(terminoDeBusquedaMapa(this.busqueda()));
  }

  protected limpiarBusqueda(): void {
    this.busqueda.set('');
    this.cancelarDebounce();
    this.terminoAplicado.set('');
    this.searchInput()?.nativeElement.focus();
  }

  protected onCategoriaChange(event: Event): void {
    const valor = (event.target as HTMLSelectElement).value;
    this.cancelarDebounce();
    this.categoria.set(valor || null);
    this.terminoAplicado.set(terminoDeBusquedaMapa(this.busqueda()));
  }

  protected limpiarFiltros(): void {
    this.busqueda.set('');
    this.categoria.set(null);
    this.cancelarDebounce();
    this.terminoAplicado.set('');
  }

  protected humanizarCategoria(categoria: string): string {
    return humanizarCategoria(categoria);
  }

  protected recargarDatos(): void {
    if (this.reintentandoDatos()) {
      return;
    }
    this.reintentandoDatos.set(true);
    this.cargarDatos();
  }

  protected reintentarMapa(): void {
    if (this.cargandoMapa()) {
      return;
    }
    const elemento = this.lienzo()?.nativeElement;
    if (!elemento) {
      return;
    }
    this.inicioSolicitado = false;
    void this.inicializarMapa(elemento);
  }

  private cargarDatos(): void {
    this.cargandoDatos.set(true);
    this.errorDatos.set(null);

    this.service
      .listar(true)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (lista) => {
          this.sucursales.set((lista ?? []) as SucursalMapaDTO[]);
          this.cargandoDatos.set(false);
          this.reintentandoDatos.set(false);
        },
        error: () => {
          this.sucursales.set([]);
          this.cargandoDatos.set(false);
          this.reintentandoDatos.set(false);
          this.errorDatos.set(
            'No pudimos cargar las sucursales. Revisá tu conexión e intentá de nuevo.',
          );
        },
      });
  }

  private async inicializarMapa(elemento: HTMLElement): Promise<void> {
    if (this.inicioSolicitado || this.motor()) {
      return;
    }
    this.inicioSolicitado = true;
    this.cargandoMapa.set(true);
    this.errorMapa.set(null);

    try {
      const espacio = await this.googleMaps.cargar();
      if (this.destruido) {
        return;
      }

      const api = espacio as unknown as GoogleMapsApi;
      const mapa = new api.maps.Map(elemento, {
        center: new api.maps.LatLng(CENTRO_INICIAL.lat, CENTRO_INICIAL.lng),
        zoom: ZOOM_INICIAL,
        mapTypeControl: false,
        streetViewControl: false,
        clickableIcons: false,
        gestureHandling: 'greedy',
      });

      this.motor.set(
        new MotorMapaSucursales(api, mapa, () =>
          this.limpiarContenidoVentana(),
        ),
      );
      this.mapaListo.set(true);
      this.cargandoMapa.set(false);
    } catch {
      if (this.destruido) {
        return;
      }
      this.cargandoMapa.set(false);
      this.errorMapa.set(
        'No pudimos cargar el mapa. Intentá de nuevo más tarde.',
      );
    }
  }

  /** Burbuja amarilla: solo la valoración, sin nombre ni categoría. */
  private iconoIndicador(sucursal: SucursalMapaDTO): string {
    const estilos = this.document.defaultView?.getComputedStyle(
      this.document.documentElement,
    );
    const color = estilos?.getPropertyValue('--accent').trim() || '';
    const tinta = estilos?.getPropertyValue('--on-accent').trim() || '';
    return iconoIndicadorMapa(textoIndicadorMapa(sucursal), color, tinta);
  }

  private crearContenidoVentana(sucursal: SucursalMapaDTO): Node {
    this.limpiarContenidoVentana();
    const raiz = this.document.createElement('div');
    raiz.setAttribute('role', 'group');
    raiz.setAttribute('aria-label', `Información de ${sucursal.nombre}`);
    raiz.style.cssText = [
      'display:grid',
      'gap:var(--space-2)',
      'max-width:17.5rem',
      'padding:var(--space-3)',
      'background:var(--surface)',
      'color:var(--text)',
      'font-family:var(--font)',
      'border-radius:var(--radius-md)',
      'border:1px solid var(--line)',
    ].join(';');
    // Interactuar con la ficha no debe interpretarse como clic fuera del mapa.
    this.registrarEnVentana(raiz, 'click', (event) => event.stopPropagation());

    const urlFoto = sucursal.fotoPerfil?.trim() || '';
    const foto = this.document.createElement('img');
    foto.setAttribute('src', urlFoto || IMAGEN_SIN_FOTO);
    foto.alt = urlFoto ? `Foto de ${sucursal.nombre}` : 'Sin imagen';
    foto.loading = 'lazy';
    foto.decoding = 'async';
    foto.style.cssText = [
      'display:block',
      'width:100%',
      'max-height:9rem',
      'object-fit:cover',
      'border-radius:var(--radius-sm)',
    ].join(';');
    if (urlFoto) {
      this.registrarEnVentana(foto, 'error', () => {
        if (foto.getAttribute('src') !== IMAGEN_SIN_FOTO) {
          foto.setAttribute('src', IMAGEN_SIN_FOTO);
        }
      });
    }
    raiz.append(foto);

    const titulo = this.document.createElement('strong');
    titulo.textContent = sucursal.nombre;
    titulo.style.cssText = 'font-size:var(--font-size-md);color:var(--accent)';
    raiz.append(titulo);

    if (sucursal.categoria) {
      const categoria = this.document.createElement('span');
      categoria.textContent = this.humanizarCategoria(sucursal.categoria);
      categoria.style.color = 'var(--muted)';
      raiz.append(categoria);
    }

    raiz.append(
      this.crearValoracionVentana(sucursal),
      this.crearDiasVentana(sucursal),
    );

    const acciones = this.document.createElement('div');
    acciones.style.cssText = [
      'display:flex',
      'flex-wrap:wrap',
      'gap:var(--space-2)',
      'margin-top:var(--space-2)',
    ].join(';');

    const detalle = this.document.createElement('button');
    detalle.type = 'button';
    detalle.textContent = 'Ver detalles';
    this.estilizarBotonVentana(detalle, true);
    this.registrarEnVentana(detalle, 'click', () => {
      this.cerrarVentana();
      void this.router.navigate(['/sucursal', sucursal.id]);
    });

    const coordenadas = coordenadasValidas(sucursal);
    if (coordenadas) {
      const llegar = this.document.createElement('button');
      llegar.type = 'button';
      llegar.textContent = 'Cómo llegar';
      this.estilizarBotonVentana(llegar, false);
      this.registrarEnVentana(llegar, 'click', () => {
        this.document.defaultView?.open(
          urlCómoLlegar(coordenadas),
          '_blank',
          'noopener,noreferrer',
        );
      });
      acciones.append(detalle, llegar);
    } else {
      acciones.append(detalle);
    }

    raiz.append(acciones);
    return raiz;
  }

  /** Abejas + valor numérico + cantidad, o el estado "Sin puntuaciones". */
  private crearValoracionVentana(sucursal: SucursalMapaDTO): HTMLElement {
    const contenedor = this.document.createElement('div');
    contenedor.style.cssText = 'display:grid;gap:var(--space-1)';

    const valor = puntuacionMapa(sucursal);
    const cantidad = sucursal.cantidadPuntuaciones ?? 0;
    if (valor === null || cantidad <= 0) {
      contenedor.textContent = 'Sin puntuaciones';
      contenedor.style.color = 'var(--muted)';
      return contenedor;
    }

    contenedor.setAttribute('role', 'group');
    contenedor.setAttribute(
      'aria-label',
      `Puntuación promedio ${valor.toFixed(1)} de 5 sobre ${cantidad} puntuaciones`,
    );

    const abejas = this.document.createElement('span');
    abejas.setAttribute('aria-hidden', 'true');
    abejas.style.cssText = 'display:flex;gap:2px;line-height:1';
    for (const llena of abejasMapa(valor)) {
      const abeja = this.document.createElement('span');
      abeja.textContent = '🐝';
      if (!llena) {
        abeja.style.cssText = 'filter:grayscale(1);opacity:0.22';
      }
      abejas.append(abeja);
    }

    const texto = this.document.createElement('span');
    texto.textContent = `${valor.toFixed(1)} / 5 · ${cantidad} puntuaciones`;
    texto.style.color = 'var(--accent)';
    texto.style.fontSize = 'var(--font-size-sm)';

    contenedor.append(abejas, texto);
    return contenedor;
  }

  /** Los siete días en orden: abiertos en acento, cerrados tachados. */
  private crearDiasVentana(sucursal: SucursalMapaDTO): HTMLElement {
    const dias = diasMapa(sucursal);
    const abiertos = dias.filter((dia) => dia.abierto).map((dia) => dia.abreviatura);
    const cerrados = dias
      .filter((dia) => !dia.abierto)
      .map((dia) => dia.abreviatura);
    const contenedor = this.document.createElement('div');
    contenedor.setAttribute('role', 'group');
    contenedor.setAttribute(
      'aria-label',
      `Días de apertura: abiertos ${abiertos.join(', ') || 'ninguno'}; cerrados ${cerrados.join(', ') || 'ninguno'}`,
    );
    contenedor.style.cssText = [
      'display:flex',
      'flex-wrap:wrap',
      'align-items:center',
      'gap:var(--space-1)',
      'font-size:var(--font-size-sm)',
    ].join(';');

    dias.forEach((dia, indice) => {
      if (indice > 0) {
        contenedor.append(this.document.createTextNode(' · '));
      }
      const etiqueta = this.document.createElement('span');
      etiqueta.textContent = dia.abreviatura;
      etiqueta.style.cssText = dia.abierto
        ? 'color:var(--accent);font-weight:700'
        : 'color:var(--muted);text-decoration:line-through;opacity:0.6';
      contenedor.append(etiqueta);
    });

    return contenedor;
  }

  private estilizarBotonVentana(
    boton: HTMLButtonElement,
    principal: boolean,
  ): void {
    boton.style.cssText = [
      'padding:var(--space-2) var(--space-3)',
      'border-radius:var(--radius-md)',
      'font:inherit',
      'font-size:var(--font-size-sm)',
      'cursor:pointer',
      principal
        ? 'border:1px solid var(--accent);background:var(--accent);color:var(--on-accent)'
        : 'border:1px solid var(--line);background:transparent;color:var(--text)',
    ].join(';');
  }

  private registrarEnVentana(
    elemento: HTMLElement,
    evento: string,
    manejador: (event: Event) => void,
  ): void {
    elemento.addEventListener(evento, manejador);
    this.removeresVentana.push(() =>
      elemento.removeEventListener(evento, manejador),
    );
  }

  private cerrarVentana(): void {
    this.limpiarContenidoVentana();
    this.motor()?.cerrarVentana();
  }

  private limpiarContenidoVentana(): void {
    for (const remover of this.removeresVentana) {
      remover();
    }
    this.removeresVentana = [];
  }

  private cancelarDebounce(): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }
}
