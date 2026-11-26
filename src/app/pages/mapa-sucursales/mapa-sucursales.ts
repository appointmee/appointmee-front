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
  esTerminoNumerico,
  normalizarTerminoBusqueda,
  terminoDeBusqueda,
} from '../../shared/busqueda-sucursales';
import {
  SucursalMapaDTO,
  coordenadasValidas,
  filtrarSucursalesMapa,
  humanizarCategoria,
  urlCómoLlegar,
} from './mapa-sucursales-datos';
import {
  GoogleMapsApi,
  MotorMapaSucursales,
} from './mapa-sucursales-motor';

/** Centro fijo de Argentina: no implica ninguna consulta de geolocalización. */
const CENTRO_INICIAL = { lat: -34.6037, lng: -58.3816 };
const ZOOM_INICIAL = 5;

/**
 * US-MAP-06 · Mapa global y público de sucursales.
 *
 * Una sola lectura de `/sucursales/listar` alimenta la página; los filtros son
 * locales y nunca vuelven a consultar el backend. La Maps JavaScript API se
 * carga con el loader centralizado únicamente cuando el lienzo se acerca al
 * viewport, y los marcadores se reconcilian sin reconstruir el mapa.
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
    return (
      termino.length > 0 &&
      termino.length < MIN_CARACTERES_BUSQUEDA &&
      !esTerminoNumerico(termino)
    );
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
      motor.actualizar(this.visibles(), (sucursal) =>
        this.crearContenidoVentana(sucursal),
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
      this.terminoAplicado.set(terminoDeBusqueda(valor));
    }, DEBOUNCE_BUSQUEDA_MS);
  }

  protected onSearchSubmit(event: Event): void {
    event.preventDefault();
    this.cancelarDebounce();
    this.terminoAplicado.set(terminoDeBusqueda(this.busqueda()));
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
    this.terminoAplicado.set(terminoDeBusqueda(this.busqueda()));
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

      this.motor.set(new MotorMapaSucursales(api, mapa));
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

    const reseñas =
      sucursal.puntuacion !== null &&
      (sucursal.cantidadPuntuaciones ?? 0) > 0
        ? `Puntuación: ${sucursal.puntuacion.toFixed(1)} de 5 (${sucursal.cantidadPuntuaciones} reseñas)`
        : 'Sin reseñas';
    const puntuacion = this.document.createElement('span');
    puntuacion.textContent = reseñas;
    puntuacion.style.color = 'var(--muted)';
    raiz.append(puntuacion);

    if (sucursal.diasApertura?.length) {
      const dias = this.document.createElement('span');
      dias.textContent = `Días de apertura: ${sucursal.diasApertura.join(', ')}`;
      dias.style.color = 'var(--muted)';
      raiz.append(dias);
    }

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
    manejador: () => void,
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
