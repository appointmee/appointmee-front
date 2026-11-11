import { DsButtonComponent } from '../../shared/ui/button/button.component';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Observable, Subject, catchError, map, of, startWith, switchMap, tap } from 'rxjs';

import { EquipoSucursal } from '../../components/equipo-sucursal/equipo-sucursal';
import { apiErrorsService } from '../../http/api-errors-service';
import { SucursalDetalleDTO } from '../../models/sucursal';
import { sucursalService } from '../../services/sucursal-service';
import { ErrorPage } from '../error/error';

type CargaResultado =
  | { readonly estado: 'ok'; readonly sucursal: SucursalDetalleDTO }
  | { readonly estado: 'no-encontrada' }
  | { readonly estado: 'error'; readonly mensaje: string };

const ESCALA_TEXTO: Readonly<Record<number, string>> = {
  1: 'Mala',
  2: 'Regular',
  3: 'Buena',
  4: 'Muy buena',
  5: 'Excelente',
};

@Component({
  selector: 'app-sucursal-equipo',
  imports: [DsButtonComponent, ErrorPage, EquipoSucursal, RouterLink],
  templateUrl: './sucursal-equipo.html',
  styleUrl: './sucursal-equipo.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SucursalEquipo {
  private readonly service = inject(sucursalService);
  private readonly route = inject(ActivatedRoute);
  private readonly title = inject(Title);
  private readonly apiErrors = inject(apiErrorsService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly sucursal = signal<SucursalDetalleDTO | null>(null);
  protected readonly sucursalId = signal<number | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly noEncontrada = signal(false);

  private readonly recargar$ = new Subject<void>();

  protected readonly volverLink = computed<readonly (string | number)[]>(() => {
    const id = this.sucursalId();
    return id ? ['/sucursal', id] : ['/sucursales'];
  });

  protected readonly puntuacion = computed(() => {
    const valor = this.sucursal()?.puntuacion;
    return typeof valor === 'number' && Number.isFinite(valor)
      ? Math.max(0, Math.min(5, Math.round(valor)))
      : 0;
  });

  protected readonly cantidad = computed(() => {
    const valor = this.sucursal()?.cantidadPuntuaciones;
    return typeof valor === 'number' && Number.isFinite(valor) && valor > 0 ? valor : 0;
  });

  protected readonly hayPuntuaciones = computed(
    () => this.cantidad() > 0 && this.sucursal()?.puntuacion !== null,
  );

  protected readonly abejas = computed(() =>
    [1, 2, 3, 4, 5].map((posicion) => posicion <= this.puntuacion()),
  );

  protected readonly etiqueta = computed(
    () => ESCALA_TEXTO[this.puntuacion()] ?? 'Sin puntuación',
  );

  constructor() {
    this.route.paramMap
      .pipe(
        map((params) => params.get('id')),
        switchMap((id) => this.recargar$.pipe(startWith(undefined), map(() => id))),
        tap((id) => this.reiniciarEstado(id)),
        switchMap((id) => this.cargar(id)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((resultado) => this.aplicarResultado(resultado));
  }

  protected reintentar(): void {
    this.recargar$.next();
  }

  private cargar(idParam: string | null): Observable<CargaResultado> {
    const id = Number(idParam);

    if (!idParam || !/^\d+$/.test(idParam) || !Number.isInteger(id) || id <= 0) {
      return of<CargaResultado>({ estado: 'no-encontrada' });
    }

    return this.service.obtenerPorId(id).pipe(
      map((sucursal): CargaResultado => ({ estado: 'ok', sucursal })),
      catchError((error: HttpErrorResponse) => of(this.mapearError(error))),
    );
  }

  private mapearError(error: HttpErrorResponse): CargaResultado {
    // La pantalla informa el problema con su propio reintento.
    this.apiErrors.dismiss();

    if (error.status === 404) {
      return { estado: 'no-encontrada' };
    }

    if (error.status === 0) {
      return {
        estado: 'error',
        mensaje:
          'No pudimos conectarnos con el servidor. Revisá tu conexión e intentá de nuevo.',
      };
    }

    return {
      estado: 'error',
      mensaje: 'No pudimos cargar la información de la sucursal. Intentá de nuevo en unos segundos.',
    };
  }

  private aplicarResultado(resultado: CargaResultado): void {
    switch (resultado.estado) {
      case 'ok':
        this.sucursal.set(resultado.sucursal);
        this.sucursalId.set(resultado.sucursal.id);
        this.title.setTitle(`AppointMee | Equipo de ${resultado.sucursal.nombre}`);
        break;
      case 'no-encontrada':
        this.noEncontrada.set(true);
        break;
      case 'error':
        this.error.set(resultado.mensaje);
        break;
    }

    this.loading.set(false);
  }

  private reiniciarEstado(idParam: string | null): void {
    const id = Number(idParam);
    this.sucursalId.set(
      idParam && /^\d+$/.test(idParam) && Number.isInteger(id) && id > 0 ? id : null,
    );
    this.sucursal.set(null);
    this.error.set(null);
    this.noEncontrada.set(false);
    this.loading.set(true);
  }
}
