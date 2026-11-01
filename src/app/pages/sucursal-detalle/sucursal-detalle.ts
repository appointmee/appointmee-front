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

import { ErrorPage } from '../error/error';
import { apiErrorsService } from '../../http/api-errors-service';
import { SucursalDetalleDTO } from '../../models/sucursal';
import { sucursalService } from '../../services/sucursal-service';

type CargaResultado =
  | { readonly estado: 'ok'; readonly sucursal: SucursalDetalleDTO }
  | { readonly estado: 'no-encontrada' }
  | { readonly estado: 'error'; readonly mensaje: string };

const NOMBRES_DIAS: Readonly<Record<string, string>> = {
  MONDAY: 'Lunes',
  TUESDAY: 'Martes',
  WEDNESDAY: 'Miércoles',
  THURSDAY: 'Jueves',
  FRIDAY: 'Viernes',
  SATURDAY: 'Sábado',
  SUNDAY: 'Domingo',
};

const HORA_VALIDA = /^([01]\d|2[0-3]):[0-5]\d$/;
const LARGO_DESCRIPCION_COLGADA = 280;

@Component({
  selector: 'app-sucursal-detalle',
  imports: [ErrorPage, RouterLink],
  templateUrl: './sucursal-detalle.html',
  styleUrl: './sucursal-detalle.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SucursalDetalle {
  private readonly service = inject(sucursalService);
  private readonly route = inject(ActivatedRoute);
  private readonly title = inject(Title);
  private readonly apiErrors = inject(apiErrorsService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly placeholderImage = `data:image/svg+xml;utf8,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="700" viewBox="0 0 1600 700"><rect width="1600" height="700" fill="#10151d"/><g fill="none" stroke="#98a2b3" stroke-width="3" opacity="0.7"><rect x="590" y="210" width="420" height="280" rx="24"/><circle cx="700" cy="290" r="36"/><path d="M590 420l110-100 90 75 70-60 150 150"/></g><text x="800" y="560" text-anchor="middle" fill="#98a2b3" font-size="30" font-family="sans-serif">Sin imagen disponible</text></svg>',
  )}`;

  protected readonly sucursal = signal<SucursalDetalleDTO | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly noEncontrada = signal(false);
  protected readonly descripcionExpandida = signal(false);

  private readonly recargar$ = new Subject<void>();

  protected readonly categoria = computed(() => this.humanizarCategoria(this.sucursal()?.categoria));

  protected readonly descripcion = computed(() => this.sucursal()?.descripcion?.trim() ?? '');

  protected readonly descripcionLarga = computed(
    () => this.descripcion().length > LARGO_DESCRIPCION_COLGADA,
  );

  protected readonly horario = computed(() => {
    const actual = this.sucursal();
    const apertura = actual?.horaApertura?.trim() ?? '';
    const cierre = actual?.horaCierre?.trim() ?? '';

    if (!HORA_VALIDA.test(apertura) || !HORA_VALIDA.test(cierre)) {
      return null;
    }

    return { apertura, cierre };
  });

  protected readonly dias = computed(() => {
    const nombres = this.sucursal()?.diasApertura ?? [];
    return nombres
      .map((dia) => NOMBRES_DIAS[dia?.toUpperCase?.() ?? ''] ?? null)
      .filter((dia): dia is string => !!dia);
  });

  protected readonly telefono = computed(() => this.sucursal()?.telefono?.trim() ?? '');

  protected readonly telefonoHref = computed(() => {
    const limpio = this.telefono()
      .replace(/[^\d+]/g, '')
      .replace(/(?!^)\+/g, '');
    return /\d/.test(limpio) ? `tel:${limpio}` : null;
  });

  protected readonly puntuacion = computed(() => {
    const valor = this.sucursal()?.puntuacion;
    return typeof valor === 'number' && Number.isFinite(valor)
      ? Math.max(0, Math.min(5, Math.round(valor)))
      : 0;
  });

  protected readonly cantidadPuntuaciones = computed(() => {
    const valor = this.sucursal()?.cantidadPuntuaciones;
    return typeof valor === 'number' && Number.isFinite(valor) && valor > 0 ? valor : 0;
  });

  protected readonly hayPuntuaciones = computed(
    () => this.cantidadPuntuaciones() > 0 && this.sucursal()?.puntuacion !== null,
  );

  protected readonly abejas = computed(() =>
    [1, 2, 3, 4, 5].map((posicion) => posicion <= this.puntuacion()),
  );

  constructor() {
    this.route.paramMap
      .pipe(
        map((params) => params.get('id')),
        switchMap((id) => this.recargar$.pipe(startWith(undefined), map(() => id))),
        tap(() => this.reiniciarEstado()),
        switchMap((id) => this.cargar(id)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((resultado) => this.aplicarResultado(resultado));
  }

  protected reintentar(): void {
    this.recargar$.next();
  }

  protected alternarDescripcion(): void {
    this.descripcionExpandida.update((expandida) => !expandida);
  }

  protected onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img.src !== this.placeholderImage) {
      img.src = this.placeholderImage;
    }
  }

  private cargar(idParam: string | null): Observable<CargaResultado> {
    const id = Number(idParam);

    if (!idParam || !/^\d+$/.test(idParam) || !Number.isInteger(id) || id <= 0) {
      return of<CargaResultado>({ estado: 'no-encontrada' });
    }

    return this.service.obtenerPorId(id).pipe(
      map((sucursal): CargaResultado => ({ estado: 'ok', sucursal })),
      catchError((err: HttpErrorResponse) => of(this.mapearError(err))),
    );
  }

  private mapearError(err: HttpErrorResponse): CargaResultado {
    // La pantalla muestra el error con su propio reintento: se evita el aviso global duplicado.
    this.apiErrors.dismiss();

    if (err.status === 404) {
      return { estado: 'no-encontrada' };
    }

    if (err.status === 0) {
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
        this.title.setTitle(`AppointMee | ${resultado.sucursal.nombre}`);
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

  private reiniciarEstado(): void {
    this.sucursal.set(null);
    this.error.set(null);
    this.noEncontrada.set(false);
    this.descripcionExpandida.set(false);
    this.loading.set(true);
  }

  private humanizarCategoria(categoria: string | null | undefined): string {
    if (!categoria) {
      return '';
    }

    return categoria
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }
}
