import { DsInputComponent } from '../../shared/ui/input/input.component';
import { DsButtonComponent } from '../../shared/ui/button/button.component';
import { DsPaginationComponent } from '../../shared/ui/misc/misc.component';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject } from 'rxjs';
import { catchError, debounceTime, map, switchMap, tap } from 'rxjs/operators';
import { of } from 'rxjs';

import { sucursalService } from '../../services/sucursal-service';
import { PaginaSucursalesDTO, SucursalMiniDTO } from '../../models/sucursal';
import { ApiErrors } from '../../http/api-errors';
import {
  DEBOUNCE_BUSQUEDA_MS,
  MIN_CARACTERES_BUSQUEDA,
  claveComparacionBusqueda,
  esTerminoNumerico,
  normalizarTerminoBusqueda,
  terminoDeBusqueda,
} from '../../shared/busqueda-sucursales';

interface SolicitudBusqueda {
  readonly termino: string;
  readonly categoria: string | null;
  /** 1-based, como se muestra en la interfaz y en la URL. */
  readonly pagina: number;
}

const TAMANO_PAGINA = 12;

@Component({
  selector: 'app-sucursales',
  imports: [DsInputComponent, DsButtonComponent, DsPaginationComponent, RouterLink],
  templateUrl: './sucursales.html',
  styleUrl: './sucursales.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Sucursales {
  private readonly service = inject(sucursalService);
  private readonly apiErrors = inject(ApiErrors);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');
  private readonly resultsRef = viewChild<ElementRef<HTMLElement>>('resultsContainer');

  protected readonly placeholderImage = `data:image/svg+xml;utf8,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="400" height="300" fill="#1a1f2b"/><g fill="none" stroke="#98a2b3" stroke-width="2"><rect x="120" y="80" width="160" height="120" rx="12"/><circle cx="160" cy="120" r="18"/><path d="M120 180l45-40 35 30 30-25 70 60"/></g><text x="200" y="215" text-anchor="middle" fill="#98a2b3" font-size="14" font-family="sans-serif">Sin imagen</text></svg>',
  )}`;

  private readonly initialSearch = normalizarTerminoBusqueda(
    this.route.snapshot.queryParamMap.get('busqueda'),
  );
  private readonly initialCategory = this.route.snapshot.queryParamMap.get('categoria');
  private readonly initialPage = this.parsearPagina(
    this.route.snapshot.queryParamMap.get('pagina'),
  );

  protected readonly searchTerm = signal(this.initialSearch);
  protected readonly selectedCategory = signal<string | null>(this.initialCategory);
  protected readonly categoriasAbiertas = signal(false);
  protected readonly terminoAplicado = signal(terminoDeBusqueda(this.initialSearch));
  protected readonly sucursales = signal<SucursalMiniDTO[]>([]);
  protected readonly categorias = signal<string[]>([]);
  protected readonly avisoCategorias = signal<string | null>(null);
  private readonly categoriasCargadas = signal(false);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly requiereLogin = signal(false);
  /** True mientras un reintento está en vuelo: bloquea dobles clics (US-ERR-03). */
  protected readonly reintentando = signal(false);

  protected readonly pagina = signal(this.initialPage);
  protected readonly totalPages = signal(0);
  protected readonly totalElements = signal(0);
  protected readonly mostrarPaginacion = computed(
    () => !this.loading() && !this.error() && this.totalPages() > 1,
  );
  protected readonly resumenPaginacion = computed(() => {
    const total = this.totalElements();
    return total === 1 ? '1 sucursal encontrada' : `${total} sucursales encontradas`;
  });

  protected readonly terminoMuyCorto = computed(() => {
    const termino = normalizarTerminoBusqueda(this.searchTerm());
    return (
      termino.length > 0 &&
      termino.length < MIN_CARACTERES_BUSQUEDA &&
      !esTerminoNumerico(termino)
    );
  });

  private readonly busqueda$ = new Subject<SolicitudBusqueda>();
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private queryParamsInicializados = false;
  private ultimaSolicitud: {
    clave: string;
    termino: string;
    categoria: string | null;
    pagina: number;
  } | null = null;

  constructor() {
    this.busqueda$
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.error.set(null);
          this.requiereLogin.set(false);
        }),
        switchMap((solicitud) =>
          this.buscarSucursales(solicitud).pipe(
            map((pagina) => ({ pagina, solicitud })),
            catchError((err: HttpErrorResponse) => {
              // Este listado presenta el error en contexto y ofrece su propio
              // reintento, que conserva búsqueda, categoría y página.
              this.apiErrors.dismiss();
              if (err.status === 401) {
                this.error.set('Necesitás iniciar sesión para ver las sucursales.');
                this.requiereLogin.set(true);
              } else if (err.status === 0) {
                this.error.set(
                  'No pudimos cargar las sucursales. Revisá tu conexión e intentá de nuevo.',
                );
              } else {
                this.error.set('No pudimos cargar las sucursales. Intentá de nuevo.');
              }
              return of({
                pagina: {
                  content: [],
                  totalElements: 0,
                  totalPages: 0,
                  number: 0,
                  size: TAMANO_PAGINA,
                } as PaginaSucursalesDTO,
                solicitud,
              });
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ pagina, solicitud }) => {
        // Si la URL apuntaba a una página ya inexistente tras cambiar filtros,
        // se corrige a la última y se vuelve a consultar antes de pintar.
        if (pagina.totalPages > 0 && pagina.number >= pagina.totalPages) {
          this.pagina.set(pagina.totalPages);
          this.actualizarUrl(solicitud.termino, solicitud.categoria);
          this.ejecutarBusqueda({ actualizarUrl: false, forzar: true });
          return;
        }

        this.sucursales.set([...pagina.content]);
        this.totalElements.set(pagina.totalElements);
        this.totalPages.set(pagina.totalPages);
        this.pagina.set(pagina.number + 1);
        this.terminoAplicado.set(solicitud.termino);
        this.loading.set(false);
        // Tanto el reintento exitoso como el fallido pasan por acá: el botón
        // vuelve a estar disponible sólo después de tener veredicto (US-ERR-03).
        this.reintentando.set(false);
      });

    this.service
      .categorias()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (cats) => {
          this.categorias.set(cats ?? []);
          this.selectedCategory.set(
            this.validarCategoria(this.route.snapshot.queryParamMap.get('categoria')),
          );
          this.categoriasCargadas.set(true);
          this.aplicarCategoriaPendiente();
        },
        error: () => {
          this.avisoCategorias.set(
            'No pudimos cargar las categorías. Podés ver todas las sucursales.',
          );
          this.selectedCategory.set(null);
          this.categoriasCargadas.set(true);
          this.aplicarCategoriaPendiente();
        },
      });

    this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((qp) => {
      this.queryParamsInicializados = true;
      const busqueda = qp['busqueda'] ?? '';
      const pagina = this.parsearPagina(qp['pagina']);
      if (pagina !== this.pagina()) {
        this.pagina.set(pagina);
      }
      if (busqueda !== this.searchTerm()) {
        this.searchTerm.set(busqueda);
      }

      // La categoría de la URL no se puede validar hasta que termine su carga.
      // Esperamos para evitar una consulta inicial sin filtro y otra posterior.
      if (!this.categoriasCargadas() && qp['categoria']) {
        return;
      }

      const categoria = this.categoriasCargadas()
        ? this.validarCategoria(qp['categoria'] ?? null)
        : null;
      if (categoria !== this.selectedCategory()) {
        this.selectedCategory.set(categoria);
      }

      // Al volver atrás o recargar, la URL manda: se aplica sin volver a escribirla.
      this.searchTerm.set(busqueda);
      this.ejecutarBusqueda({ actualizarUrl: false, forzar: true });
    });

    this.destroyRef.onDestroy(() => this.cancelarDebounce());
  }

  private validarCategoria(categoria: string | null): string | null {
    return categoria && this.categorias().includes(categoria) ? categoria : null;
  }

  private aplicarCategoriaPendiente(): void {
    if (!this.queryParamsInicializados || !this.route.snapshot.queryParamMap.has('categoria')) {
      return;
    }

    this.ejecutarBusqueda({ actualizarUrl: false, forzar: true });
  }

  protected onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchTerm.set(value);
    this.cancelarDebounce();

    const termino = normalizarTerminoBusqueda(value);

    if (!termino) {
      // Al vaciar el campo se vuelve al listado completo sin esperar el debounce.
      this.pagina.set(1);
      this.ejecutarBusqueda();
      return;
    }

    if (termino.length < MIN_CARACTERES_BUSQUEDA && !esTerminoNumerico(termino)) {
      return;
    }

    this.pagina.set(1);
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.ejecutarBusqueda();
    }, DEBOUNCE_BUSQUEDA_MS);
  }

  protected onSearchSubmit(event: Event): void {
    event.preventDefault();
    this.cancelarDebounce();

    const termino = normalizarTerminoBusqueda(this.searchTerm());

    if (!termino) {
      this.pagina.set(1);
      this.ejecutarBusqueda({ forzar: true });
      return;
    }

    if (termino.length < MIN_CARACTERES_BUSQUEDA && !esTerminoNumerico(termino)) {
      return;
    }

    // Enter dispara la búsqueda en el momento, sin esperar los 350 ms.
    this.pagina.set(1);
    this.ejecutarBusqueda({ forzar: true });
  }

  protected clearSearch(): void {
    this.searchTerm.set('');
    this.cancelarDebounce();
    this.pagina.set(1);
    this.ejecutarBusqueda({ forzar: true });
    this.searchInput()?.nativeElement.focus();
  }

  protected selectCategory(categoria: string | null): void {
    this.categoriasAbiertas.set(false);
    if (categoria === this.selectedCategory()) {
      return;
    }

    this.selectedCategory.set(categoria);
    this.cancelarDebounce();
    this.pagina.set(1);
    this.ejecutarBusqueda({ forzar: true });
  }

  protected alternarCategorias(): void {
    this.categoriasAbiertas.update((abiertas) => !abiertas);
  }

  protected irAPagina(pagina: number): void {
    const destino = Math.max(1, Math.trunc(pagina));
    if (destino === this.pagina() || destino > this.totalPages()) {
      return;
    }

    this.cancelarDebounce();
    this.pagina.set(destino);
    this.ejecutarBusqueda();
    this.desplazarseArriba();
  }

  private desplazarseArriba(): void {
    const elemento = this.resultsRef()?.nativeElement;
    if (!elemento || typeof elemento.scrollIntoView !== 'function') {
      return;
    }
    const reduceMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    elemento.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }

  protected retry(): void {
    if (this.reintentando()) return;
    this.reintentando.set(true);
    this.cancelarDebounce();
    this.ejecutarBusqueda({ actualizarUrl: false, forzar: true });
  }

  protected onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.src = this.placeholderImage;
  }

  protected humanizeCategory(categoria: string | null | undefined): string {
    if (!categoria) {
      return '';
    }
    return categoria
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  protected hasReviews(sucursal: SucursalMiniDTO): boolean {
    return (sucursal.cantidadPuntuaciones ?? 0) > 0 && sucursal.puntuacion !== null;
  }

  protected promedioFormateado(puntuacion: number | null): string {
    return typeof puntuacion === 'number' && Number.isFinite(puntuacion)
      ? puntuacion.toFixed(1)
      : '0.0';
  }

  protected beeString(puntuacion: number | null): string {
    const score = Math.max(0, Math.min(5, Math.round(puntuacion ?? 0)));
    return '🐝'.repeat(score);
  }

  protected cardAriaLabel(sucursal: SucursalMiniDTO): string {
    const base = sucursal.nombre;
    if (!this.hasReviews(sucursal)) {
      return `${base}, sin reseñas. Ver detalle`;
    }
    return `${base}, ${this.promedioFormateado(sucursal.puntuacion)} de 5, ${sucursal.cantidadPuntuaciones} reseñas. Ver detalle`;
  }

  protected trackById(_index: number, sucursal: SucursalMiniDTO): number {
    return sucursal.id;
  }

  private ejecutarBusqueda(
    opciones: { actualizarUrl?: boolean; forzar?: boolean } = {},
  ): void {
    const { actualizarUrl = true, forzar = false } = opciones;
    const termino = terminoDeBusqueda(this.searchTerm());
    const categoria = this.selectedCategory();
    const pagina = this.pagina();
    const clave = this.claveSolicitud(termino, categoria, pagina);

    this.terminoAplicado.set(termino);

    if (actualizarUrl) {
      this.actualizarUrl(termino, categoria);
    }

    if (!forzar && this.ultimaSolicitud?.clave === clave) {
      return;
    }

    this.ultimaSolicitud = { clave, termino, categoria, pagina };
    this.busqueda$.next({ termino, categoria, pagina });
  }

  private actualizarUrl(termino: string, categoria: string | null): void {
    const tree = this.router.parseUrl(this.router.url);
    const actualTermino = normalizarTerminoBusqueda(tree.queryParams['busqueda'] ?? '');
    const actualCategoria = tree.queryParams['categoria'] ?? null;
    const actualPagina = this.parsearPagina(tree.queryParams['pagina']);

    if (
      actualTermino === termino &&
      actualCategoria === categoria &&
      actualPagina === this.pagina()
    ) {
      return;
    }

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        busqueda: termino || null,
        categoria,
        pagina: this.pagina() > 1 ? this.pagina() : null,
      },
      queryParamsHandling: 'merge',
    });
  }

  private claveSolicitud(
    termino: string,
    categoria: string | null,
    pagina: number,
  ): string {
    return `${claveComparacionBusqueda(termino)}|${categoria ?? ''}|${pagina}`;
  }

  private parsearPagina(valor: unknown): number {
    const numero = Number(valor);
    return Number.isInteger(numero) && numero > 0 ? numero : 1;
  }

  private cancelarDebounce(): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  private buscarSucursales(
    solicitud: SolicitudBusqueda,
  ): ReturnType<sucursalService['listarPaginado']> {
    // El listado conserva el manejo global de errores (503/401 => /error o login)
    // y además muestra su propio estado inline para fallos de red.
    return this.service.listarPaginado(
      solicitud.categoria,
      solicitud.termino || null,
      solicitud.pagina - 1,
      TAMANO_PAGINA,
      false,
    );
  }
}
