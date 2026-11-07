import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import {
  catchError,
  combineLatest,
  distinctUntilChanged,
  map,
  of,
  startWith,
  Subject,
  switchMap,
  tap,
  timer,
} from 'rxjs';

import { authService } from '../../services/auth-service';
import { SucursalMiniDTO } from '../../models/sucursal';
import { sucursalService } from '../../services/sucursal-service';
import { BRANCH_CATEGORIES } from '../../models/branch';

interface SuggestionResult {
  readonly term: string;
  readonly suggestions: readonly SucursalMiniDTO[];
  readonly error: string | null;
}

function comparisonKey(value: string): string {
  return value.trim().toLocaleLowerCase('es');
}

@Component({
  selector: 'app-home',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home implements OnInit {
  private readonly auth = inject(authService);
  private readonly sucursalesService = inject(sucursalService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private searchFocused = false;
  private readonly lastSuggestionTerm = signal<string | null>(null);
  private readonly mobileOpen = signal(false);
  private readonly scrolled = signal(false);
  private readonly currentYear = signal(new Date().getFullYear());

  protected readonly isAuthenticated = this.auth.autenticado;
  protected readonly search = new FormControl('', { nonNullable: true });
  protected readonly suggestions = signal<readonly SucursalMiniDTO[]>([]);
  protected readonly suggestionsOpen = signal(false);
  protected readonly suggestionsLoading = signal(false);
  protected readonly suggestionsError = signal<string | null>(null);
  protected readonly activeSuggestionIndex = signal(-1);
  protected readonly term = signal('');
  protected readonly termTooShort = computed(() => this.term().trim().length === 1);

  // Listado de sucursales destacado en la home (US-HOME-05).
  protected readonly sucursales = signal<SucursalMiniDTO[]>([]);
  protected readonly sucursalesLoading = signal(true);
  protected readonly sucursalesError = signal<string | null>(null);
  /** Bloquea múltiples clics en "Reintentar" mientras hay una petición en vuelo. */
  protected readonly sucursalesReintentando = signal(false);
  protected readonly sucursalesTerm = signal('');
  protected readonly sucursalesCategoria = signal<string | null>(null);
  protected readonly sucursalesCategorias = signal(BRANCH_CATEGORIES);

  protected readonly placeholderImage = `data:image/svg+xml;utf8,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="400" height="300" fill="#1a1f2b"/><g fill="none" stroke="#98a2b3" stroke-width="2"><rect x="120" y="80" width="160" height="120" rx="12"/><circle cx="160" cy="120" r="18"/><path d="M120 180l45-40 35 30 30-25 70 60"/></g><text x="200" y="235" text-anchor="middle" fill="#98a2b3" font-size="14" font-family="sans-serif">Sin imagen</text></svg>',
  )}`;

  private readonly reloadSucursales = new Subject<void>();
  /** Último [término, categoría] consultado: distingue una consulta nueva de un reintento. */
  private readonly ultimoFiltros = signal<[string, string | null] | null>(null);
  /** Marca si la consulta en vuelo falló, para decidir si se conserva el mensaje de error. */
  private ultimoFallo = false;

  constructor() {
    this.search.valueChanges
      .pipe(
        map((value) => value.trim()),
        tap(() => this.term.set(this.search.value)),
        distinctUntilChanged(
          (previous, current) => comparisonKey(previous) === comparisonKey(current),
        ),
        tap(() => {
          this.suggestions.set([]);
          this.suggestionsError.set(null);
          this.suggestionsLoading.set(false);
          this.suggestionsOpen.set(false);
          this.activeSuggestionIndex.set(-1);
          this.lastSuggestionTerm.set(null);
        }),
        switchMap((term) => {
          if (term.length < 2) {
            return of<SuggestionResult>({ term, suggestions: [], error: null });
          }

          return timer(350).pipe(
            tap(() => {
              this.suggestionsLoading.set(true);
              this.suggestionsOpen.set(this.searchFocused);
            }),
            switchMap(() =>
              this.sucursalesService.filtrar(null, term).pipe(
                map((suggestions): SuggestionResult => ({ term, suggestions, error: null })),
                catchError(() =>
                  of<SuggestionResult>({
                    term,
                    suggestions: [],
                    error: 'No pudimos cargar las sugerencias. Intentá nuevamente.',
                  }),
                ),
              ),
            ),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        this.suggestionsLoading.set(false);
        this.suggestions.set(result.suggestions);
        this.suggestionsError.set(result.error);
        this.lastSuggestionTerm.set(result.term);
        this.suggestionsOpen.set(this.searchFocused && result.term.length >= 2);
      });

    this.inicializarListadoSucursales();
  }

  private inicializarListadoSucursales(): void {
    const term$ = toObservable(this.sucursalesTerm).pipe(
      map((value) => (value ?? '').trim()),
      distinctUntilChanged(),
    );
    const categoria$ = toObservable(this.sucursalesCategoria).pipe(distinctUntilChanged());

    combineLatest<[string, string | null, void]>([
      term$,
      categoria$,
      this.reloadSucursales.pipe(startWith(undefined as void)),
    ])
      .pipe(
        tap(([nombre, categoria]) => {
          const previo = this.ultimoFiltros();
          const esConsultaNueva =
            previo === null || previo[0] !== nombre || previo[1] !== categoria;
          if (esConsultaNueva) {
            // Una búsqueda/filtro nuevo limpia el error previo y muestra esqueleto.
            this.sucursalesError.set(null);
            this.ultimoFiltros.set([nombre, categoria]);
          }
          this.sucursalesLoading.set(true);
          this.ultimoFallo = false;
        }),
        switchMap(([nombre, categoria]) => {
          const fuente = nombre
            ? this.sucursalesService.filtrar(categoria, nombre, true)
            : this.sucursalesService.listar(true);
          return fuente.pipe(
            catchError((err: HttpErrorResponse) => {
              // El contexto SIN_MANEJO_GLOBAL_DE_ERRORES evita que el interceptor
              // navegue a /error: la falla se presenta solo como estado inline aquí.
              this.ultimoFallo = true;
              if (err.status === 0) {
                this.sucursalesError.set(
                  'No hay conexión a Internet. Revisá tu red e intentá de nuevo.',
                );
              } else if (err.status === 401) {
                this.sucursalesError.set('Necesitás iniciar sesión para ver las sucursales.');
              } else {
                this.sucursalesError.set('No pudimos cargar las sucursales. Intentá de nuevo.');
              }
              return of<SucursalMiniDTO[]>([]);
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((lista) => {
        this.sucursales.set(lista ?? []);
        this.sucursalesLoading.set(false);
        this.sucursalesReintentando.set(false);
        // Sólo se limpia el error cuando la consulta se resolvió con éxito.
        if (!this.ultimoFallo) {
          this.sucursalesError.set(null);
        }
      });
  }

  protected submitSearch(event: Event): void {
    event.preventDefault();
    const term = this.search.value.trim();
    if (term.length < 2) {
      return;
    }

    const suggestions = this.suggestions();
    const resultadosActuales =
      !this.suggestionsLoading() &&
      !this.suggestionsError() &&
      comparisonKey(this.lastSuggestionTerm() ?? '') === comparisonKey(term);

    if (resultadosActuales && suggestions.length === 1) {
      this.selectSuggestion(suggestions[0]);
      return;
    }

    this.closeSuggestions();
    void this.router.navigate(['/sucursales'], {
      queryParams: { busqueda: term },
    });
  }

  protected clearSearch(): void {
    this.search.setValue('');
  }

  // ---------- Listado de sucursales destacado (US-HOME-05) ----------

  protected retrySucursales(): void {
    if (this.sucursalesReintentando()) return;
    this.sucursalesReintentando.set(true);
    this.reloadSucursales.next();
  }

  protected onSucursalesSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.sucursalesTerm.set(value);
  }

  protected clearSucursalesSearch(): void {
    this.sucursalesTerm.set('');
  }

  protected selectSucursalesCategoria(categoria: string | null): void {
    this.sucursalesCategoria.set(categoria);
  }

  protected sucursalesEmptyTitle(): string {
    const tieneFiltro = !!this.sucursalesTerm() || this.sucursalesCategoria() !== null;
    return tieneFiltro
      ? 'No hay resultados para tu búsqueda'
      : 'No hay sucursales en la plataforma';
  }

  protected sucursalesEmptyDescription(): string {
    const tieneFiltro = !!this.sucursalesTerm() || this.sucursalesCategoria() !== null;
    if (tieneFiltro) {
      return 'Probá con otro término o categoria.';
    }
    return 'Pronto tendremos más establecimientos disponibles.';
  }

  /** Mensaje anunciado por lectores de pantalla según el estado del listado. */
  protected readonly sucursalesAviso = computed(() => {
    if (this.sucursalesLoading()) {
      return 'Cargando sucursales';
    }
    if (this.sucursalesError()) {
      return this.sucursalesError();
    }
    if (this.sucursales().length === 0) {
      return this.sucursalesEmptyTitle();
    }
    return null;
  });

  protected sucursalesCardAriaLabel(sucursal: SucursalMiniDTO): string {
    const base = sucursal.nombre;
    const tiene = (sucursal.cantidadPuntuaciones ?? 0) > 0 && sucursal.puntuacion !== null;
    if (!tiene) {
      return `${base}, sin reseñas. Ver detalle`;
    }
    return `${base}, ${sucursal.puntuacion.toFixed(1)} de 5, ${sucursal.cantidadPuntuaciones} reseñas. Ver detalle`;
  }

  protected trackBySucursalId(_index: number, sucursal: SucursalMiniDTO): number {
    return sucursal.id;
  }

  protected onSucursalesImageError(event: Event): void {
    (event.target as HTMLImageElement).src = this.placeholderImage;
  }

  protected onSearchFocus(): void {
    this.searchFocused = true;
    const term = this.search.value.trim();
    if (
      term.length >= 2 &&
      (this.suggestionsLoading() ||
        comparisonKey(this.lastSuggestionTerm() ?? '') === comparisonKey(term))
    ) {
      this.suggestionsOpen.set(true);
    }
  }

  protected onSuggestionImageError(event: Event): void {
    (event.target as HTMLImageElement).hidden = true;
  }

  protected onSearchKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeSuggestions();
      return;
    }

    const suggestions = this.suggestions();
    if (!this.suggestionsOpen() || suggestions.length === 0) {
      return;
    }

    // Enter confirma una opción elegida explícitamente con las flechas.
    if (event.key === 'Enter' && this.activeSuggestionIndex() >= 0) {
      event.preventDefault();
      this.selectSuggestion(suggestions[this.activeSuggestionIndex()]);
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.activeSuggestionIndex.update((index) => (index + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.activeSuggestionIndex.update((index) =>
        index <= 0 ? suggestions.length - 1 : index - 1,
      );
    }
  }

  protected selectSuggestion(sucursal: SucursalMiniDTO): void {
    this.search.setValue(sucursal.nombre, { emitEvent: false });
    this.term.set(sucursal.nombre);
    this.closeSuggestions();
    void this.router.navigate(['/sucursal', sucursal.id]);
  }

  protected categoryLabel(category: string): string {
    const label = category.replaceAll('_', ' ').toLocaleLowerCase('es');
    return `${label.charAt(0).toLocaleUpperCase('es')}${label.slice(1)}`;
  }

  @HostListener('window:scroll')
  protected onScroll(): void {
    this.scrolled.set(window.scrollY > 12);
  }

  @HostListener('window:resize')
  protected onResize(): void {
    if (window.innerWidth > 1024 && this.mobileOpen()) {
      this.closeMobile();
    }
  }

  @HostListener('document:keydown', ['$event'])
  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.closeSuggestions();
      this.closeMobile();
    }
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    const target = event.target;
    if (!(target instanceof Element) || !target.closest('.branch-search-wrap')) {
      this.closeSuggestions();
    }
  }

  protected toggleMobile(): void {
    this.mobileOpen.update((open) => !open);
    if (this.mobileOpen()) {
      document.body.classList.add('nav-locked');
    } else {
      document.body.classList.remove('nav-locked');
    }
  }

  protected closeMobile(): void {
    this.mobileOpen.set(false);
    document.body.classList.remove('nav-locked');
  }

  private closeSuggestions(): void {
    this.searchFocused = false;
    this.suggestionsOpen.set(false);
    this.activeSuggestionIndex.set(-1);
  }

  ngOnInit(): void {
    const qp = this.route.snapshot.queryParams;
    if (qp['busqueda'] || qp['categoria']) {
      void this.router.navigate(['/sucursales'], { queryParams: qp });
    }
  }

  protected scrollToSection(event: Event, sectionId: string): void {
    event.preventDefault();
    const element = document.getElementById(sectionId);
    if (element) {
      const navHeight = 86;
      const top = element.getBoundingClientRect().top + window.scrollY - navHeight;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  }
}
