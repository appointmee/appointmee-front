import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { toObservable } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { combineLatest, of, Subject } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, startWith, switchMap, tap } from 'rxjs/operators';

import { SucursalService } from '../../services/sucursal.service';
import { SucursalMiniDTO } from '../../models/sucursal.model';
import { ApiErrors } from '../../http/api-errors';

@Component({
  selector: 'app-sucursales',
  imports: [RouterLink],
  templateUrl: './sucursales.html',
  styleUrl: './sucursales.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Sucursales {
  private readonly service = inject(SucursalService);
  private readonly apiErrors = inject(ApiErrors);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly placeholderImage = `data:image/svg+xml;utf8,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="400" height="300" fill="#1a1f2b"/><g fill="none" stroke="#98a2b3" stroke-width="2"><rect x="120" y="80" width="160" height="120" rx="12"/><circle cx="160" cy="120" r="18"/><path d="M120 180l45-40 35 30 30-25 70 60"/></g><text x="200" y="235" text-anchor="middle" fill="#98a2b3" font-size="14" font-family="sans-serif">Sin imagen</text></svg>',
  )}`;

  private readonly initialSearch = this.route.snapshot.queryParamMap.get('busqueda') ?? '';
  private readonly initialCategory = this.route.snapshot.queryParamMap.get('categoria');

  protected readonly searchTerm = signal(this.initialSearch);
  protected readonly selectedCategory = signal<string | null>(this.initialCategory);
  protected readonly sucursales = signal<SucursalMiniDTO[]>([]);
  protected readonly categorias = signal<string[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly requiereLogin = signal(false);
  /** True mientras un reintento está en vuelo: bloquea dobles clics (US-ERR-03). */
  protected readonly reintentando = signal(false);

  private readonly searchSubject = new Subject<string>();
  /** Re-emitido al presionar "Reintentar": re-ejecuta la consulta fallida tal como estaba. */
  private readonly reintento = new Subject<void>();

  constructor() {
    const search$ = this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      startWith(this.searchTerm()),
    );
    const category$ = toObservable(this.selectedCategory);
    const reintento$ = this.reintento.pipe(startWith(undefined as void));

    combineLatest([search$, category$, reintento$])
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.error.set(null);
          this.requiereLogin.set(false);
        }),
        switchMap(([nombre, categoria]) =>
          this.service.filtrar(categoria, nombre).pipe(
            catchError((err: HttpErrorResponse) => {
              // Este listado presenta el error en contexto y ofrece su propio
              // reintento, que conserva búsqueda y categoría sin duplicar avisos.
              this.apiErrors.dismiss();
              if (err.status === 401) {
                this.error.set('Necesitás iniciar sesión para ver las sucursales.');
                this.requiereLogin.set(true);
              } else if (err.status === 0) {
                this.error.set(
                  'No pudimos conectar con el backend. Verificá que esté corriendo en http://localhost:8080 y que uses npm start (puerto 3000).',
                );
              } else {
                this.error.set('No pudimos cargar las sucursales. Intentá de nuevo.');
              }
              return of<SucursalMiniDTO[]>([]);
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((lista) => {
        this.sucursales.set(lista ?? []);
        this.loading.set(false);
        // Tanto el reintento exitoso como el fallido pasan por acá: el botón
        // vuelve a estar disponible sólo después de tener veredicto (US-ERR-03).
        this.reintentando.set(false);
      });

    this.service
      .categorias()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (cats) => this.categorias.set(cats ?? []),
        error: (err: HttpErrorResponse) => {
          if (err.status === 401) {
            this.error.set('Necesitás iniciar sesión para ver las sucursales.');
            this.requiereLogin.set(true);
            this.loading.set(false);
          }
        },
      });

    this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((qp) => {
      const busqueda = qp['busqueda'] ?? '';
      if (busqueda !== this.searchTerm()) {
        this.searchTerm.set(busqueda);
        this.searchSubject.next(busqueda);
      }
      const categoria = qp['categoria'] ?? null;
      if (categoria !== this.selectedCategory()) {
        this.selectedCategory.set(categoria);
      }
    });
  }

  protected onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchTerm.set(value);
    this.updateFilterUrl(
      { busqueda: value || null, categoria: this.selectedCategory() },
      () => this.searchSubject.next(value),
    );
  }

  protected clearSearch(): void {
    this.searchTerm.set('');
    this.updateFilterUrl(
      { busqueda: null, categoria: this.selectedCategory() },
      () => this.searchSubject.next(''),
    );
  }

  protected selectCategory(categoria: string | null): void {
    this.selectedCategory.set(categoria);
    this.updateFilterUrl(
      { busqueda: this.searchTerm() || null, categoria },
      () => this.selectedCategory.set(categoria),
    );
  }

  private updateFilterUrl(
    queryParams: { busqueda: string | null; categoria: string | null },
    onCommitted: () => void,
  ): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    }).then(onCommitted);
  }

  protected retry(): void {
    if (this.reintentando()) return;
    this.reintentando.set(true);
    this.reintento.next();
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

  protected beeString(puntuacion: number | null): string {
    const score = Math.max(0, Math.min(5, Math.round(puntuacion ?? 0)));
    return '🐝'.repeat(score);
  }

  protected ratingLabel(sucursal: SucursalMiniDTO): string {
    if (!this.hasReviews(sucursal)) {
      return 'Sin reseñas';
    }
    return `${sucursal.puntuacion} de 5, ${sucursal.cantidadPuntuaciones} reseñas`;
  }

  protected cardAriaLabel(sucursal: SucursalMiniDTO): string {
    const base = sucursal.nombre;
    if (!this.hasReviews(sucursal)) {
      return `${base}, sin reseñas. Ver detalle`;
    }
    return `${base}, ${sucursal.puntuacion} de 5, ${sucursal.cantidadPuntuaciones} reseñas. Ver detalle`;
  }

  protected trackById(_index: number, sucursal: SucursalMiniDTO): number {
    return sucursal.id;
  }
}
