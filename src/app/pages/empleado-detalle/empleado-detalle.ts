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

import { apiErrorsService } from '../../http/api-errors-service';
import { EmpleadoDTO } from '../../models/empleado';
import { SucursalDetalleDTO } from '../../models/sucursal';
import { empleadoService } from '../../services/empleado-service';
import { sucursalService } from '../../services/sucursal-service';

type CargaResultado =
  | { readonly estado: 'ok'; readonly sucursal: SucursalDetalleDTO; readonly empleado: EmpleadoDTO }
  | { readonly estado: 'sucursal-no-encontrada' }
  | { readonly estado: 'empleado-no-encontrado'; readonly sucursal: SucursalDetalleDTO }
  | { readonly estado: 'error'; readonly mensaje: string };

const ESCALA_TEXTO: Readonly<Record<number, string>> = {
  1: 'Mala',
  2: 'Regular',
  3: 'Buena',
  4: 'Muy buena',
  5: 'Excelente',
};

@Component({
  selector: 'app-empleado-detalle',
  imports: [DsButtonComponent, RouterLink],
  templateUrl: './empleado-detalle.html',
  styleUrl: './empleado-detalle.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmpleadoDetalle {
  private readonly sucursales = inject(sucursalService);
  private readonly empleados = inject(empleadoService);
  private readonly route = inject(ActivatedRoute);
  private readonly title = inject(Title);
  private readonly apiErrors = inject(apiErrorsService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly resultado = signal<CargaResultado | null>(null);
  protected readonly loading = signal(true);

  private readonly recargar$ = new Subject<void>();

  protected readonly placeholderAvatar = `data:image/svg+xml;utf8,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240"><rect width="240" height="240" fill="#10151d"/><circle cx="120" cy="92" r="38" fill="#39424f"/><path d="M48 216c9-47 36-72 72-72s63 25 72 72" fill="#39424f"/></svg>',
  )}`;

  protected readonly sucursal = computed(() => {
    const resultado = this.resultado();
    return resultado?.estado === 'ok' || resultado?.estado === 'empleado-no-encontrado'
      ? resultado.sucursal
      : null;
  });

  protected readonly empleado = computed(() => {
    const resultado = this.resultado();
    return resultado?.estado === 'ok' ? resultado.empleado : null;
  });

  protected readonly sucursalNoEncontrada = computed(
    () => this.resultado()?.estado === 'sucursal-no-encontrada',
  );

  protected readonly empleadoNoEncontrado = computed(
    () => this.resultado()?.estado === 'empleado-no-encontrado',
  );

  protected readonly error = computed(() => {
    const resultado = this.resultado();
    return resultado?.estado === 'error' ? resultado.mensaje : null;
  });

  protected readonly nombreCompleto = computed(() => {
    const empleado = this.empleado();
    return empleado ? this.unirNombre(empleado) : '';
  });

  protected readonly puntuacion = computed(() => {
    const valor = this.empleado()?.puntuacion;
    return typeof valor === 'number' && Number.isFinite(valor)
      ? Math.max(0, Math.min(5, Math.round(valor)))
      : 0;
  });

  protected readonly cantidad = computed(() => {
    const valor = this.empleado()?.cantidadPuntuaciones;
    return typeof valor === 'number' && Number.isFinite(valor) && valor > 0
      ? Math.floor(valor)
      : 0;
  });

  protected readonly tienePuntuacion = computed(
    () => this.cantidad() > 0 && this.empleado()?.puntuacion !== null,
  );

  protected readonly abejas = computed(() =>
    [1, 2, 3, 4, 5].map((posicion) => posicion <= this.puntuacion()),
  );

  protected readonly etiqueta = computed(
    () => ESCALA_TEXTO[this.puntuacion()] ?? 'Sin puntuación',
  );

  protected readonly reseniasTexto = computed(() =>
    this.cantidad() === 1 ? '1 reseña' : `${this.cantidad()} reseñas`,
  );

  protected readonly volverLink = computed<readonly (string | number)[]>(() => {
    const sucursal = this.sucursal();
    return sucursal ? ['/sucursal', sucursal.id, 'equipo'] : ['/sucursales'];
  });

  constructor() {
    this.route.paramMap
      .pipe(
        map((params) => ({
          sucursalId: this.parseId(params.get('sucursalId')),
          empleadoId: this.parseId(params.get('empleadoId')),
        })),
        switchMap((ids) => this.recargar$.pipe(startWith(undefined), map(() => ids))),
        tap(() => this.reiniciarEstado()),
        switchMap(({ sucursalId, empleadoId }) => this.cargar(sucursalId, empleadoId)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((resultado) => this.aplicarResultado(resultado));
  }

  protected reintentar(): void {
    this.recargar$.next();
  }

  protected onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.onerror = null;
    img.src = this.placeholderAvatar;
  }

  private cargar(
    sucursalId: number | null,
    empleadoId: number | null,
  ): Observable<CargaResultado> {
    if (sucursalId === null) {
      return of<CargaResultado>({ estado: 'sucursal-no-encontrada' });
    }

    return this.sucursales.obtenerPorId(sucursalId, true).pipe(
      switchMap((sucursal) => {
        if (empleadoId === null) {
          return of<CargaResultado>({ estado: 'empleado-no-encontrado', sucursal });
        }

        return this.empleados.listarPorSucursal(sucursalId).pipe(
          map((lista): CargaResultado => {
            const empleado = (lista ?? []).find((item) => item.id === empleadoId);
            return empleado
              ? { estado: 'ok', sucursal, empleado }
              : { estado: 'empleado-no-encontrado', sucursal };
          }),
          catchError((error: HttpErrorResponse) => {
            this.apiErrors.dismiss();
            return of<CargaResultado>({
              estado: 'error',
              mensaje: this.mensajeErrorEmpleados(error),
            });
          }),
        );
      }),
      catchError((error: HttpErrorResponse) => {
        this.apiErrors.dismiss();
        return of<CargaResultado>(
          error.status === 404
            ? { estado: 'sucursal-no-encontrada' }
            : { estado: 'error', mensaje: this.mensajeErrorSucursal(error) },
        );
      }),
    );
  }

  private aplicarResultado(resultado: CargaResultado): void {
    this.resultado.set(resultado);

    if (resultado.estado === 'ok') {
      this.title.setTitle(`AppointMee | ${this.unirNombre(resultado.empleado)}`);
    } else if (resultado.estado === 'empleado-no-encontrado') {
      this.title.setTitle('AppointMee | Profesional no encontrado');
    }

    this.loading.set(false);
  }

  private reiniciarEstado(): void {
    this.resultado.set(null);
    this.loading.set(true);
  }

  private mensajeErrorSucursal(error: HttpErrorResponse): string {
    if (error.status === 0) {
      return 'No pudimos conectarnos con el servidor. Revisá tu conexión e intentá de nuevo.';
    }

    if (error.status === 401) {
      return 'Tu sesión expiró. Iniciá sesión nuevamente para ver al profesional.';
    }

    return 'No pudimos cargar la sucursal del profesional. Intentá de nuevo en unos segundos.';
  }

  private mensajeErrorEmpleados(error: HttpErrorResponse): string {
    if (error.status === 0) {
      return 'No pudimos conectarnos con el servidor. Revisá tu conexión e intentá de nuevo.';
    }

    if (error.status === 401) {
      return 'Tu sesión expiró. Iniciá sesión nuevamente para ver al profesional.';
    }

    return 'No pudimos cargar la información del profesional. Intentá de nuevo en unos segundos.';
  }

  private unirNombre(empleado: EmpleadoDTO): string {
    return [empleado.nombre, empleado.apellido].filter(Boolean).join(' ').trim();
  }

  private parseId(valor: string | null): number | null {
    if (!valor || !/^\d+$/.test(valor)) return null;
    const id = Number(valor);
    return Number.isInteger(id) && id > 0 ? id : null;
  }
}
