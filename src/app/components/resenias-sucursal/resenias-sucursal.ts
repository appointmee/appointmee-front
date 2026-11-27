import { DsButtonComponent } from '../../shared/ui/button/button.component';
import { DsPaginationComponent } from '../../shared/ui/misc/misc.component';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { Observable, Subject, catchError, combineLatest, map, of, startWith, switchMap, tap } from 'rxjs';

import { apiErrorsService } from '../../http/api-errors-service';
import { ReseniaDTO } from '../../models/resenia';
import { reseniaService } from '../../services/resenia-service';

const LIMITE_DETALLE = 5;
const ESCALA_TEXTO: Readonly<Record<number, string>> = {
  1: 'Mala',
  2: 'Regular',
  3: 'Buena',
  4: 'Muy buena',
  5: 'Excelente',
};

interface DatosResenias {
  readonly resenias: readonly ReseniaDTO[];
  /** Total informado por backend; null cuando no viene en la respuesta. */
  readonly total: number | null;
  readonly totalPages: number;
  readonly hayMas: boolean;
}

@Component({
  selector: 'app-resenias-sucursal',
  imports: [DsButtonComponent, DsPaginationComponent, RouterLink],
  templateUrl: './resenias-sucursal.html',
  styleUrl: './resenias-sucursal.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReseniasSucursal {
  private readonly service = inject(reseniaService);
  private readonly apiErrors = inject(apiErrorsService);
  private readonly destroyRef = inject(DestroyRef);

  readonly sucursalId = input.required<number>();
  readonly puntuacion = input<number | null>(null);
  readonly cantidad = input<number | null>(null);
  /** Se conserva por compatibilidad: el backend ya limita la vista previa a 5. */
  readonly limite = input<number | null>(LIMITE_DETALLE);
  readonly mostrarVerMas = input(true);
  readonly mostrarResumen = input(true);
  /** Historial completo: consulta el endpoint paginado (10 reseñas por página). */
  readonly paginaCompleta = input(false);

  protected readonly resenias = signal<readonly ReseniaDTO[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly reintentando = signal(false);
  /** Página 0-based pedida al backend; sólo se usa en modo historial. */
  protected readonly pagina = signal(0);
  protected readonly totalPaginas = signal(0);
  private readonly totalBackend = signal<number | null>(null);
  private readonly hayMasBackend = signal(false);

  private readonly recargar$ = new Subject<void>();

  protected readonly total = computed(() => {
    const backend = this.totalBackend();
    if (backend !== null) {
      return backend;
    }

    const declarado = this.cantidad();
    return typeof declarado === 'number' && Number.isFinite(declarado) && declarado >= 0
      ? declarado
      : this.resenias().length;
  });

  protected readonly promedio = computed(() => {
    const declarado = this.puntuacion();
    if (typeof declarado === 'number' && Number.isFinite(declarado)) {
      return Math.round(this.normalizarPuntuacion(declarado) * 10) / 10;
    }

    const lista = this.resenias();
    if (!lista.length) {
      return 0;
    }

    const suma = lista.reduce(
      (acumulado, resenia) => acumulado + this.normalizarPuntuacion(resenia.puntuacion),
      0,
    );
    return Math.round((suma / lista.length) * 10) / 10;
  });

  protected readonly hayResenias = computed(() => this.total() > 0 || this.resenias().length > 0);

  protected readonly abejas = computed(() =>
    [1, 2, 3, 4, 5].map((posicion) => posicion <= this.promedio()),
  );

  protected readonly etiquetaPromedio = computed(() => this.etiqueta(this.promedio()));

  /** El contenido ya viene filtrado y ordenado por backend: no se recorta ni se reordena acá. */
  protected readonly visibles = computed(() => this.resenias());

  protected readonly hayMas = computed(
    () => !this.paginaCompleta() && this.mostrarVerMas() && this.hayMasBackend(),
  );

  protected readonly puedePaginarse = computed(
    () =>
      this.paginaCompleta() &&
      !this.loading() &&
      !this.error() &&
      this.totalPaginas() > 1,
  );

  constructor() {
    combineLatest([
      toObservable(this.sucursalId),
      toObservable(this.paginaCompleta),
      toObservable(this.pagina),
      this.recargar$.pipe(startWith(undefined)),
    ])
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.error.set(null);
        }),
        switchMap(([id, paginaCompleta, page]) => this.cargar(id, paginaCompleta, page)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((datos) => this.aplicarDatos(datos));
  }

  protected reintentar(): void {
    if (this.reintentando()) return;
    this.reintentando.set(true);
    this.recargar$.next();
  }

  /** ds-pagination emite páginas 1-based; el servicio trabaja con índices 0-based. */
  protected cambiarPagina(pagina: number): void {
    const destino = Math.max(1, Math.trunc(pagina));
    if (
      !this.paginaCompleta() ||
      destino > this.totalPaginas() ||
      destino === this.pagina() + 1
    ) {
      return;
    }

    this.pagina.set(destino - 1);
  }

  protected abejasResenia(resenia: ReseniaDTO): readonly boolean[] {
    const puntuacion = this.normalizarPuntuacion(resenia.puntuacion);
    return [1, 2, 3, 4, 5].map((posicion) => posicion <= puntuacion);
  }

  protected etiquetaResenia(resenia: ReseniaDTO): string {
    return this.etiqueta(this.normalizarPuntuacion(resenia.puntuacion));
  }

  protected puntuacionResenia(resenia: ReseniaDTO): number {
    return this.normalizarPuntuacion(resenia.puntuacion);
  }

  /** El nombre viene del snapshot de la reseña, no de la relación con el usuario. */
  protected empleadoResenia(resenia: ReseniaDTO): string {
    const nombre = resenia.empleadoNombre?.trim() ?? '';
    const apellido = resenia.empleadoApellido?.trim() ?? '';
    return `${nombre} ${apellido}`.trim();
  }

  /** Aclaración separada para poder mostrarla en blanco, sin cambiar el texto. */
  protected aclaracionEmpleado(resenia: ReseniaDTO): string {
    return resenia.empleadoPerteneceASucursal === false
      ? ' (Ya no forma parte de la sucursal)'
      : '';
  }

  protected comentarioResenia(resenia: ReseniaDTO): string {
    const comentario = resenia.comentario?.trim();
    return comentario ? comentario : 'Sin comentario';
  }

  protected fechaResenia(resenia: ReseniaDTO): string {
    const valor = resenia.fechaResenia?.trim() ?? '';
    const partes = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor);

    return partes ? `${partes[3]}/${partes[2]}/${partes[1]}` : 'Sin fecha';
  }

  private cargar(
    id: number,
    paginaCompleta: boolean,
    page: number,
  ): Observable<DatosResenias> {
    if (!Number.isInteger(id) || id <= 0) {
      return of(this.sinDatos());
    }

    const origen: Observable<DatosResenias> = paginaCompleta
      ? this.service.listarPaginadoPorSucursal(id, page).pipe(
          map((pagina) => ({
            resenias: pagina?.content ?? [],
            total: this.enteroNoNegativo(pagina?.totalElements),
            totalPages: this.enteroNoNegativo(pagina?.totalPages) ?? 0,
            hayMas: false,
          })),
        )
      : this.service.listarPorSucursal(id).pipe(
          map((vistaPrevia) => ({
            resenias: vistaPrevia?.content ?? [],
            total: this.enteroNoNegativo(vistaPrevia?.totalElements),
            totalPages: 0,
            hayMas: vistaPrevia?.hayMas === true,
          })),
        );

    return origen.pipe(
      catchError((error: HttpErrorResponse) => {
        // La sección informa el problema sin interrumpir el resto del detalle.
        this.apiErrors.dismiss();
        this.error.set(this.mensajeError(error));
        return of(this.sinDatos());
      }),
    );
  }

  private aplicarDatos(datos: DatosResenias): void {
    this.resenias.set(datos.resenias);
    this.totalBackend.set(datos.total);
    this.totalPaginas.set(datos.totalPages);
    this.hayMasBackend.set(datos.hayMas);
    this.loading.set(false);
    this.reintentando.set(false);
  }

  private sinDatos(): DatosResenias {
    return { resenias: [], total: null, totalPages: 0, hayMas: false };
  }

  private enteroNoNegativo(valor: unknown): number | null {
    return typeof valor === 'number' && Number.isInteger(valor) && valor >= 0 ? valor : null;
  }

  private normalizarPuntuacion(valor: number | null | undefined): number {
    return typeof valor === 'number' && Number.isFinite(valor)
      ? Math.max(0, Math.min(5, valor))
      : 0;
  }

  private etiqueta(puntuacion: number): string {
    return ESCALA_TEXTO[Math.round(puntuacion)] ?? 'Sin puntuación';
  }

  private mensajeError(error: HttpErrorResponse): string {
    if (error.status === 0) {
      return 'No pudimos conectarnos para cargar las reseñas. Revisá tu conexión e intentá de nuevo.';
    }

    if (error.status === 401) {
      return 'Tu sesión expiró. Iniciá sesión nuevamente para ver las reseñas.';
    }

    return 'No pudimos cargar las reseñas de esta sucursal. Intentá de nuevo en unos segundos.';
  }
}
