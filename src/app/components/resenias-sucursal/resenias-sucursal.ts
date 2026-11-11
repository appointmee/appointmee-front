import { DsButtonComponent } from '../../shared/ui/button/button.component';
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
import { Observable, Subject, catchError, map, of, startWith, switchMap, tap } from 'rxjs';

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

@Component({
  selector: 'app-resenias-sucursal',
  imports: [DsButtonComponent, RouterLink],
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
  readonly limite = input<number | null>(LIMITE_DETALLE);
  readonly mostrarVerMas = input(true);
  readonly mostrarResumen = input(true);

  protected readonly resenias = signal<readonly ReseniaDTO[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  private readonly recargar$ = new Subject<void>();

  protected readonly total = computed(() => {
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

  protected readonly visibles = computed(() => {
    const limite = this.limite();
    if (limite === null || !Number.isFinite(limite) || limite < 0) {
      return this.resenias();
    }
    return this.resenias().slice(0, Math.floor(limite));
  });

  protected readonly hayMas = computed(() => {
    const limite = this.limite();
    return (
      this.mostrarVerMas() &&
      limite !== null &&
      Number.isFinite(limite) &&
      limite >= 0 &&
      this.resenias().length > limite
    );
  });

  constructor() {
    toObservable(this.sucursalId)
      .pipe(
        switchMap((id) => this.recargar$.pipe(startWith(undefined), map(() => id))),
        tap(() => {
          this.loading.set(true);
          this.error.set(null);
        }),
        switchMap((id) => this.cargar(id)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((lista) => {
        this.resenias.set(lista);
        this.loading.set(false);
      });
  }

  protected reintentar(): void {
    this.recargar$.next();
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

  protected comentarioResenia(resenia: ReseniaDTO): string {
    const comentario = resenia.comentario?.trim();
    return comentario ? comentario : 'Sin comentario';
  }

  protected fechaResenia(resenia: ReseniaDTO): string {
    const valor = resenia.fechaResenia?.trim() ?? '';
    const partes = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor);

    return partes ? `${partes[3]}/${partes[2]}/${partes[1]}` : 'Sin fecha';
  }

  private cargar(id: number): Observable<readonly ReseniaDTO[]> {
    if (!Number.isInteger(id) || id <= 0) {
      return of([]);
    }

    return this.service.listarPorSucursal(id).pipe(
      map((lista) => this.ordenar(lista ?? [])),
      catchError((error: HttpErrorResponse) => {
        // La sección informa el problema sin interrumpir el resto del detalle.
        this.apiErrors.dismiss();
        this.error.set(this.mensajeError(error));
        return of<readonly ReseniaDTO[]>([]);
      }),
    );
  }

  private ordenar(lista: readonly ReseniaDTO[]): readonly ReseniaDTO[] {
    return [...lista].sort(
      (a, b) => this.fechaParaOrden(b.fechaResenia) - this.fechaParaOrden(a.fechaResenia),
    );
  }

  private fechaParaOrden(fecha: string | null): number {
    const partes = /^(\d{4})-(\d{2})-(\d{2})/.exec(fecha?.trim() ?? '');
    if (!partes) {
      return 0;
    }

    const valor = new Date(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3]));
    return Number.isNaN(valor.getTime()) ? 0 : valor.getTime();
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
