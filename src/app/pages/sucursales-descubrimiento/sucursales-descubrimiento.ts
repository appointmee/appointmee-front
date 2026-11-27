import { DsInputComponent } from '../../shared/ui/input/input.component';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  map,
  of,
  switchMap,
  tap,
} from 'rxjs';

import { CarruselSucursales } from '../../components/carrusel-sucursales/carrusel-sucursales';
import {
  DEBOUNCE_BUSQUEDA_MS,
  MIN_CARACTERES_BUSQUEDA,
  claveComparacionBusqueda,
  esTerminoNumerico,
  normalizarTerminoBusqueda,
} from '../../shared/busqueda-sucursales';
import { RecomendacionesSucursalesDTO, SucursalMiniDTO } from '../../models/sucursal';
import { authService } from '../../services/auth-service';
import { sucursalService } from '../../services/sucursal-service';

interface SeccionDescubrimiento {
  readonly id: string;
  readonly titulo: string;
  readonly descripcion: string;
  readonly sucursales: readonly SucursalMiniDTO[];
  readonly personal?: boolean;
}

interface SugerenciasBusqueda {
  readonly termino: string;
  readonly sucursales: readonly SucursalMiniDTO[];
  readonly error: string | null;
}

/** Pantalla principal de Sucursales: buscador y descubrimiento por secciones. */
@Component({
  selector: 'app-sucursales-descubrimiento',
  imports: [DsInputComponent, ReactiveFormsModule, CarruselSucursales, RouterLink],
  templateUrl: './sucursales-descubrimiento.html',
  styleUrl: './sucursales-descubrimiento.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SucursalesDescubrimiento {
  private readonly router = inject(Router);
  private readonly sucursalesService = inject(sucursalService);
  private readonly auth = inject(authService);
  private readonly destroyRef = inject(DestroyRef);
  private buscadorEnfocado = false;
  private readonly ultimoTerminoSugerencias = signal<string | null>(null);

  protected readonly search = new FormControl('', { nonNullable: true });
  protected readonly term = signal('');
  protected readonly terminoCorto = signal(false);
  protected readonly sugerencias = signal<readonly SucursalMiniDTO[]>([]);
  protected readonly sugerenciasAbiertas = signal(false);
  protected readonly sugerenciasCargando = signal(false);
  protected readonly sugerenciasError = signal<string | null>(null);
  protected readonly indiceSugerenciaActiva = signal(-1);

  protected readonly recomendaciones = signal<RecomendacionesSucursalesDTO | null>(null);
  protected readonly recomendacionesLoading = signal(true);
  protected readonly recomendacionesError = signal<string | null>(null);
  protected readonly reintentandoRecomendaciones = signal(false);

  /** Las secciones sin resultados no se renderizan. «Visto recientemente» y
   * «Recomendado para vos» requieren sesión; el resto es público. «Todas» es
   * una vista previa y siempre ofrece el acceso al listado completo. */
  protected readonly secciones = computed<readonly SeccionDescubrimiento[]>(() => {
    const datos = this.recomendaciones();
    if (!datos) {
      return [];
    }

    const autenticado = this.auth.autenticado();

    return [
      {
        id: 'mejores',
        titulo: 'Las mejores de AppointMee',
        descripcion: 'Las más valoradas por la comunidad, según reseñas y puntuación.',
        sucursales: datos.mejores ?? [],
      },
      {
        id: 'demandadas',
        titulo: 'Las más demandadas',
        descripcion: 'Las sucursales con más turnos confirmados en los últimos 30 días.',
        sucursales: datos.masDemandadas ?? [],
      },
      {
        id: 'nuevas',
        titulo: 'Nuevas en AppointMee',
        descripcion: 'Establecimientos que se sumaron en los últimos dos meses.',
        sucursales: datos.nuevas ?? [],
      },
      {
        id: 'recientes',
        titulo: 'Visto recientemente',
        descripcion: 'Volvé a las sucursales que visitaste últimamente.',
        sucursales: datos.vistasRecientes ?? [],
        personal: true,
      },
      {
        id: 'para-vos',
        titulo: 'Recomendado para vos',
        descripcion: 'Sugerencias según tus reservas y tus categorías preferidas.',
        sucursales: datos.paraVos ?? [],
        personal: true,
      },
      {
        id: 'todas',
        titulo: 'Todas las sucursales',
        descripcion: 'Un adelanto de todo lo que podés reservar en AppointMee.',
        sucursales: datos.todas ?? [],
      },
    ].filter(
      (seccion) =>
        seccion.sucursales.length > 0 && (autenticado || !seccion.personal),
    );
  });

  /** La acción destacada acompaña exclusivamente a la preview del listado. */
  protected readonly mostrarListadoCompleto = computed(() =>
    this.secciones().some((seccion) => seccion.id === 'todas'),
  );

  constructor() {
    this.search.valueChanges
      .pipe(
        tap((valor) => this.term.set(valor)),
        map(normalizarTerminoBusqueda),
        distinctUntilChanged((anterior, actual) =>
          claveComparacionBusqueda(anterior) === claveComparacionBusqueda(actual),
        ),
        tap((termino) => {
          this.actualizarTerminoCorto(termino);
          this.sugerencias.set([]);
          this.sugerenciasError.set(null);
          this.sugerenciasCargando.set(false);
          this.sugerenciasAbiertas.set(false);
          this.indiceSugerenciaActiva.set(-1);
          this.ultimoTerminoSugerencias.set(null);
        }),
        debounceTime(DEBOUNCE_BUSQUEDA_MS),
        switchMap((termino) => {
          if (!this.terminoBuscable(termino)) {
            return of<SugerenciasBusqueda>({ termino, sucursales: [], error: null });
          }

          this.sugerenciasCargando.set(true);
          this.sugerenciasAbiertas.set(this.buscadorEnfocado);
          return this.sucursalesService.filtrar(null, termino, true).pipe(
            map(
              (sucursales): SugerenciasBusqueda => ({
                termino,
                sucursales: sucursales ?? [],
                error: null,
              }),
            ),
            catchError(() =>
              of<SugerenciasBusqueda>({
                termino,
                sucursales: [],
                error: 'No pudimos cargar las sugerencias. Intentá nuevamente.',
              }),
            ),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((resultado) => {
        this.sugerenciasCargando.set(false);
        this.sugerencias.set(resultado.sucursales);
        this.sugerenciasError.set(resultado.error);
        this.ultimoTerminoSugerencias.set(resultado.termino);
        this.sugerenciasAbiertas.set(
          this.buscadorEnfocado && this.terminoBuscable(resultado.termino),
        );
      });

    this.cargarRecomendaciones();
  }

  /** Enter confirma la búsqueda general en el listado completo. */
  protected submitSearch(event: Event): void {
    event.preventDefault();
    const termino = normalizarTerminoBusqueda(this.search.value);
    if (!this.terminoBuscable(termino)) {
      this.actualizarTerminoCorto(termino);
      return;
    }

    this.cerrarSugerencias();
    void this.router.navigate(['/listado-sucursales'], { queryParams: { busqueda: termino } });
  }

  protected clearSearch(): void {
    this.search.setValue('');
  }

  protected onSearchFocus(): void {
    this.buscadorEnfocado = true;
    const termino = normalizarTerminoBusqueda(this.search.value);
    if (
      this.terminoBuscable(termino) &&
      (this.sugerenciasCargando() ||
        claveComparacionBusqueda(this.ultimoTerminoSugerencias()) ===
          claveComparacionBusqueda(termino))
    ) {
      this.sugerenciasAbiertas.set(true);
    }
  }

  protected onSearchKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.cerrarSugerencias();
      return;
    }

    const sugerencias = this.sugerencias();
    if (!this.sugerenciasAbiertas() || sugerencias.length === 0) {
      return;
    }

    // Enter confirma una opción elegida explícitamente con las flechas.
    if (event.key === 'Enter' && this.indiceSugerenciaActiva() >= 0) {
      event.preventDefault();
      this.seleccionarSugerencia(sugerencias[this.indiceSugerenciaActiva()]);
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.indiceSugerenciaActiva.update((indice) => (indice + 1) % sugerencias.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.indiceSugerenciaActiva.update((indice) =>
        indice <= 0 ? sugerencias.length - 1 : indice - 1,
      );
    }
  }

  protected seleccionarSugerencia(sucursal: SucursalMiniDTO): void {
    this.search.setValue(sucursal.nombre, { emitEvent: false });
    this.term.set(sucursal.nombre);
    this.actualizarTerminoCorto(sucursal.nombre);
    this.cerrarSugerencias();
    void this.router.navigate(['/sucursal', sucursal.id]);
  }

  protected etiquetaCategoria(categoria: string): string {
    const texto = categoria.replaceAll('_', ' ').toLocaleLowerCase('es');
    return `${texto.charAt(0).toLocaleUpperCase('es')}${texto.slice(1)}`;
  }

  protected onImagenSugerenciaError(event: Event): void {
    (event.target as HTMLImageElement).hidden = true;
  }

  @HostListener('document:keydown', ['$event'])
  protected onDocumentKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.cerrarSugerencias();
    }
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (!(event.target instanceof Element) || !event.target.closest('.branch-search-wrap')) {
      this.cerrarSugerencias();
    }
  }

  protected reintentarRecomendaciones(): void {
    if (this.reintentandoRecomendaciones()) {
      return;
    }
    this.reintentandoRecomendaciones.set(true);
    this.cargarRecomendaciones();
  }

  private terminoBuscable(termino: string): boolean {
    return termino.length >= MIN_CARACTERES_BUSQUEDA || esTerminoNumerico(termino);
  }

  private actualizarTerminoCorto(termino: string): void {
    const normalizado = normalizarTerminoBusqueda(termino);
    this.terminoCorto.set(
      normalizado.length > 0 &&
        normalizado.length < MIN_CARACTERES_BUSQUEDA &&
        !esTerminoNumerico(normalizado),
    );
  }

  private cerrarSugerencias(): void {
    this.buscadorEnfocado = false;
    this.sugerenciasAbiertas.set(false);
    this.indiceSugerenciaActiva.set(-1);
  }

  private cargarRecomendaciones(): void {
    this.recomendacionesLoading.set(true);
    this.recomendaciones.set(null);

    this.sucursalesService
      .recomendaciones()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (datos) => {
          this.recomendaciones.set(datos);
          this.recomendacionesError.set(null);
          this.recomendacionesLoading.set(false);
          this.reintentandoRecomendaciones.set(false);
        },
        error: () => {
          this.recomendacionesError.set(
            'No pudimos cargar las recomendaciones. Revisá tu conexión e intentá de nuevo.',
          );
          this.recomendacionesLoading.set(false);
          this.reintentandoRecomendaciones.set(false);
        },
      });
  }
}
