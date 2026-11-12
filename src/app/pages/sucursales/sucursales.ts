import { DsInputComponent } from '../../shared/ui/input/input.component';
import { DsButtonComponent } from '../../shared/ui/button/button.component';
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
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { combineLatest, Observable, of, Subject } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, filter, map, startWith, switchMap, tap } from 'rxjs/operators';

import { sucursalService } from '../../services/sucursal-service';
import { SucursalMiniDTO } from '../../models/sucursal';
import { ApiErrors } from '../../http/api-errors';
import {
  DEBOUNCE_BUSQUEDA_MS,
  MIN_CARACTERES_BUSQUEDA,
  claveComparacionBusqueda,
  normalizarTerminoBusqueda,
  terminoDeBusqueda,
} from '../../shared/busqueda-sucursales';

interface SolicitudBusqueda {
  readonly termino: string;
  readonly categoria: string | null;
}

@Component({
  selector: 'app-sucursales',
  imports: [DsInputComponent, DsButtonComponent, RouterLink],
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

  protected readonly placeholderImage = `data:image/svg+xml;utf8,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="400" height="300" fill="#1a1f2b"/><g fill="none" stroke="#98a2b3" stroke-width="2"><rect x="120" y="80" width="160" height="120" rx="12"/><circle cx="160" cy="120" r="18"/><path d="M120 180l45-40 35 30 30-25 70 60"/></g><text x="200" y="215" text-anchor="middle" fill="#98a2b3" font-size="14" font-family="sans-serif">Sin imagen</text></svg>',
  )}`;

  private readonly initialSearch = normalizarTerminoBusqueda(
    this.route.snapshot.queryParamMap.get('busqueda'),
  );
  private readonly initialCategory = this.route.snapshot.queryParamMap.get('categoria');

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

  protected readonly terminoMuyCorto = computed(() => {
    const termino = normalizarTerminoBusqueda(this.searchTerm());
    return termino.length > 0 && termino.length < MIN_CARACTERES_BUSQUEDA;
  });

  private readonly busqueda$ = new Subject<SolicitudBusqueda>();
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private ultimaSolicitud: { clave: string; termino: string; categoria: string | null } | null = null;

  constructor() {
    this.busqueda$
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.error.set(null);
          this.requiereLogin.set(false);
        }),
        switchMap((solicitud) =>
          this.buscarSucursales(solicitud.categoria, solicitud.termino).pipe(
            map((lista) => ({ lista: lista ?? [], solicitud })),
            catchError((err: HttpErrorResponse) => {
              // Este listado presenta el error en contexto y ofrece su propio
              // reintento, que conserva búsqueda y categoría sin duplicar avisos.
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
              return of({ lista: [] as SucursalMiniDTO[], solicitud });
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ lista, solicitud }) => {
        this.sucursales.set(lista);
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
          this.selectedCategory.set(this.validarCategoria(this.route.snapshot.queryParamMap.get('categoria')));
          this.categoriasCargadas.set(true);
        },
        error: () => {
          this.avisoCategorias.set('No pudimos cargar las categorías. Podés ver todas las sucursales.');
          this.selectedCategory.set(null);
          this.categoriasCargadas.set(true);
        },
      });

    this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((qp) => {
      const busqueda = qp['busqueda'] ?? '';
      if (busqueda !== this.searchTerm()) {
        this.searchTerm.set(busqueda);
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

  protected onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchTerm.set(value);
    this.cancelarDebounce();

    const termino = normalizarTerminoBusqueda(value);

    if (!termino) {
      // Al vaciar el campo se vuelve al listado completo sin esperar el debounce.
      this.ejecutarBusqueda();
      return;
    }

    if (termino.length < MIN_CARACTERES_BUSQUEDA) {
      return;
    }

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
      this.ejecutarBusqueda({ forzar: true });
      return;
    }

    if (termino.length < MIN_CARACTERES_BUSQUEDA) {
      return;
    }

    // Enter dispara la búsqueda en el momento, sin esperar los 350 ms.
    this.ejecutarBusqueda({ forzar: true });
  }

  protected clearSearch(): void {
    this.searchTerm.set('');
    this.cancelarDebounce();
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
    this.ejecutarBusqueda({ forzar: true });
  }

  protected alternarCategorias(): void {
    this.categoriasAbiertas.update((abiertas) => !abiertas);
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
    return (
      (sucursal.cantidadPuntuaciones ?? 0) > 0 && sucursal.puntuacion !== null
    );
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
    const clave = this.claveSolicitud(termino, categoria);

    this.terminoAplicado.set(termino);

    if (actualizarUrl) {
      this.actualizarUrl(termino, categoria);
    }

    if (!forzar && this.ultimaSolicitud?.clave === clave) {
      return;
    }

    this.ultimaSolicitud = { clave, termino, categoria };
    this.busqueda$.next({ termino, categoria });
  }

  private actualizarUrl(termino: string, categoria: string | null): void {
    const tree = this.router.parseUrl(this.router.url);
    const actualTermino = normalizarTerminoBusqueda(tree.queryParams['busqueda'] ?? '');
    const actualCategoria = tree.queryParams['categoria'] ?? null;

    if (actualTermino === termino && actualCategoria === categoria) {
      return;
    }

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { busqueda: termino || null, categoria },
      queryParamsHandling: 'merge',
    });
  }

  private claveSolicitud(termino: string, categoria: string | null): string {
    return `${claveComparacionBusqueda(termino)}|${categoria ?? ''}`;
  }

  private cancelarDebounce(): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  private buscarSucursales(
    categoria: string | null,
    nombre: string | null,
  ): Observable<SucursalMiniDTO[]> {
    const termino = normalizarTerminoBusqueda(nombre);
    if (/^\d+$/.test(termino)) {
      return this.service.listar().pipe(
        map((lista) =>
          (lista ?? []).filter(
            (sucursal) =>
              String(sucursal.id) === termino &&
              (!categoria || sucursal.categoria === categoria),
          ),
        ),
      );
    }

    return this.service.filtrar(categoria, termino || null);
  }
}
