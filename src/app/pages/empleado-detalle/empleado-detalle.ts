import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subject, forkJoin, of } from 'rxjs';
import { catchError, map, startWith, switchMap } from 'rxjs/operators';

import {
  EmpleadoDTO,
  EmpleadoSucursalDTO,
  combinarEmpleadosSucursal,
} from '../../models/empleado';
import { UsuarioResponseDTO } from '../../models/usuario';
import { empleadoService } from '../../services/empleado-service';
import { sucursalService } from '../../services/sucursal-service';

const FORMATO_PUNTUACION = new Intl.NumberFormat('es-AR', {
  maximumFractionDigits: 1,
});

const MAXIMO_ABEJAS = 5;

type Resultado<T> =
  | { readonly ok: true; readonly datos: readonly T[] }
  | { readonly ok: false; readonly error: HttpErrorResponse };

/**
 * Detalle de un empleado de la sucursal. Reutiliza los mismos endpoints que
 * el listado del gestor: `/sucursales/{id}/empleados` para los datos del
 * usuario y `/sucursales/{id}/elegir-empleado` para la puntuación promedio.
 */
@Component({
  selector: 'app-empleado-detalle',
  imports: [RouterLink],
  templateUrl: './empleado-detalle.html',
  styleUrl: './empleado-detalle.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmpleadoDetalle {
  private readonly sucursalesApi = inject(sucursalService);
  private readonly empleadosApi = inject(empleadoService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly sucursalId = this.parseId(
    this.route.snapshot.paramMap.get('sucursalId'),
  );
  protected readonly empleadoId = this.parseId(
    this.route.snapshot.paramMap.get('empleadoId'),
  );

  protected readonly empleado = signal<EmpleadoSucursalDTO | null>(null);
  protected readonly cargando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly reintentando = signal(false);
  protected readonly noEncontrado = signal(false);

  protected readonly nombreCompleto = computed(() => {
    const empleado = this.empleado();
    if (!empleado) {
      return '';
    }

    return [empleado.nombre?.trim(), empleado.apellido?.trim()]
      .filter(Boolean)
      .join(' ');
  });

  protected readonly placeholderAvatar = `data:image/svg+xml;utf8,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240"><rect width="240" height="240" fill="#10151d"/><circle cx="120" cy="92" r="38" fill="#39424f"/><path d="M48 216c9-47 36-72 72-72s63 25 72 72" fill="#39424f"/></svg>',
  )}`;

  private readonly recargar = new Subject<void>();

  constructor() {
    const sucursalId = this.sucursalId;
    const empleadoId = this.empleadoId;

    if (sucursalId === null || empleadoId === null) {
      this.error.set('No pudimos identificar al empleado solicitado.');
      this.noEncontrado.set(true);
      return;
    }

    this.recargar
      .pipe(
        startWith(undefined as void),
        switchMap(() => {
          this.cargando.set(this.empleado() === null);
          this.error.set(null);
          this.noEncontrado.set(false);

          return forkJoin({
            empleados: this.sucursalesApi.listarEmpleados(sucursalId).pipe(
              map(
                (lista): Resultado<UsuarioResponseDTO> => ({
                  ok: true,
                  datos: lista ?? [],
                }),
              ),
              catchError((error: HttpErrorResponse) =>
                of<Resultado<UsuarioResponseDTO>>({ ok: false, error }),
              ),
            ),
            puntuaciones: this.empleadosApi.listarPorSucursal(sucursalId).pipe(
              map(
                (lista): Resultado<EmpleadoDTO> => ({ ok: true, datos: lista ?? [] }),
              ),
              catchError((error: HttpErrorResponse) =>
                of<Resultado<EmpleadoDTO>>({ ok: false, error }),
              ),
            ),
          });
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ empleados, puntuaciones }) => {
        this.reintentando.set(false);

        if (!empleados.ok) {
          this.empleado.set(null);
          this.error.set(this.mensajeError(empleados.error));
          this.cargando.set(false);
          return;
        }

        this.error.set(null);

        const lista = combinarEmpleadosSucursal(
          empleados.datos,
          puntuaciones.ok ? puntuaciones.datos : [],
        );
        const encontrado = lista.find((item) => item.id === empleadoId) ?? null;

        this.empleado.set(encontrado);
        this.noEncontrado.set(encontrado === null);
        this.cargando.set(false);
      });
  }

  protected reintentar(): void {
    if (this.reintentando()) return;

    this.reintentando.set(true);
    this.recargar.next();
  }

  protected foto(empleado: EmpleadoSucursalDTO): string {
    return empleado.urlFotoPerfil?.trim() || this.placeholderAvatar;
  }

  protected onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.onerror = null;
    img.src = this.placeholderAvatar;
  }

  protected tienePuntuacion(empleado: EmpleadoSucursalDTO): boolean {
    const cantidad = empleado.cantidadPuntuaciones;
    return (
      typeof cantidad === 'number' &&
      Number.isFinite(cantidad) &&
      cantidad > 0 &&
      typeof empleado.puntuacion === 'number' &&
      Number.isFinite(empleado.puntuacion)
    );
  }

  protected puntuacionTexto(empleado: EmpleadoSucursalDTO): string {
    if (!this.tienePuntuacion(empleado)) {
      return '';
    }

    const valor = empleado.puntuacion;
    return typeof valor === 'number'
      ? `${FORMATO_PUNTUACION.format(valor)}/${MAXIMO_ABEJAS}`
      : '';
  }

  protected cantidadResenias(empleado: EmpleadoSucursalDTO): string {
    const cantidad = empleado.cantidadPuntuaciones;
    if (typeof cantidad !== 'number' || !Number.isFinite(cantidad) || cantidad <= 0) {
      return '';
    }

    return cantidad === 1 ? '1 reseña' : `${cantidad} reseñas`;
  }

  protected abejas(empleado: EmpleadoSucursalDTO): readonly boolean[] {
    if (!this.tienePuntuacion(empleado)) {
      return [];
    }

    const valor = empleado.puntuacion ?? 0;
    const puntuacion = Math.max(0, Math.min(MAXIMO_ABEJAS, Math.round(valor)));
    return Array.from({ length: MAXIMO_ABEJAS }, (_, indice) => indice < puntuacion);
  }

  protected readonly volverLink = computed<readonly (string | number)[]>(() =>
    this.sucursalId !== null
      ? ['/mis-sucursales', this.sucursalId, 'empleados']
      : ['/mis-sucursales'],
  );

  private parseId(value: string | null): number | null {
    if (!value?.trim()) {
      return null;
    }

    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
  }

  private mensajeError(error: HttpErrorResponse): string {
    if (error.status === 401) {
      return 'Necesitás iniciar sesión para ver el detalle del empleado.';
    }

    if (error.status === 403) {
      return 'Tu cuenta no tiene permiso para ver el detalle del empleado.';
    }

    if (error.status === 404) {
      return 'No encontramos la sucursal solicitada.';
    }

    if (error.status === 0) {
      return 'No pudimos conectar con el servidor. Revisá tu conexión e intentá de nuevo.';
    }

    return 'No pudimos cargar el detalle del empleado. Intentá de nuevo en unos segundos.';
  }
}
