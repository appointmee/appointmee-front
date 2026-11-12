import { DsButtonComponent } from '../../shared/ui/button/button.component';
import { DsModalComponent } from '../../shared/ui/misc/misc.component';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Observable, Subject, of } from 'rxjs';
import { catchError, map, startWith, switchMap } from 'rxjs/operators';

import { ServicioDTO } from '../../models/servicio';
import { authService } from '../../services/auth-service';
import { servicioService } from '../../services/servicio-service';
import { formatearDuracion } from '../../shared/duracion';
import { ServicioEditarModal } from '../servicio-editar-modal/servicio-editar-modal';
import { ServicioEliminarModal } from '../servicio-eliminar-modal/servicio-eliminar-modal';

const FORMATO_PRECIO = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
});

/** Formato de la puntuación: un decimal, como en el resto de la aplicación. */
const FORMATO_PUNTUACION = new Intl.NumberFormat('es-AR', {
  maximumFractionDigits: 1,
});

/** Cantidad de abejas de la escala de puntuación. */
const MAXIMO_ABEJAS = 5;

/** Resultado de consultar el detalle de un servicio. */
type ResultadoDetalle =
  | { readonly ok: true; readonly servicio: ServicioDTO }
  | { readonly ok: false; readonly error: HttpErrorResponse };

/**
 * Modal con el detalle de un servicio de la sucursal (US-SERV-02).
 *
 * Consulta `GET /servicios/{servicioId}` y muestra nombre, descripción,
 * duración, precio, foto y puntuación. Desde acá se abre el formulario de
 * modificación y la eliminación del servicio (US-SERV-03), que quedan por
 * encima de este modal.
 */
@Component({
  selector: 'app-servicio-detalle-modal',
  imports: [DsButtonComponent, DsModalComponent, ServicioEditarModal, ServicioEliminarModal],
  templateUrl: './servicio-detalle-modal.html',
  styleUrl: './servicio-detalle-modal.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServicioDetalleModal {
  private readonly api = inject(servicioService);
  private readonly auth = inject(authService);
  private readonly destroyRef = inject(DestroyRef);

  /** Identificador del servicio a mostrar. `null` mantiene el modal cerrado. */
  readonly servicioId = input<number | null>(null);
  /** Se emite cuando el usuario pide cerrar el modal. */
  readonly cerrar = output<void>();
  /** Se emite cuando el servicio fue modificado y hay que refrescar el listado. */
  readonly modificado = output<void>();
  /** Se emite cuando el servicio fue eliminado y hay que refrescar el listado. */
  readonly eliminado = output<void>();

  protected readonly servicio = signal<ServicioDTO | null>(null);
  protected readonly cargando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly reintentando = signal(false);
  protected readonly exito = signal<string | null>(null);
  /** Indica que el formulario de modificación está abierto por encima. */
  protected readonly editando = signal(false);
  /** Indica que las confirmaciones de eliminación están abiertas por encima. */
  protected readonly confirmandoEliminacion = signal(false);

  /**
   * Solo el empleador puede eliminar servicios: es el rol que autoriza el
   * endpoint `DELETE /servicios/eliminar/{servicioId}`. El backend sigue
   * validando el permiso (y que la sucursal sea del empleador), así que esto
   * solo evita mostrar una acción que el servidor va a rechazar.
   */
  protected readonly puedeEliminar = computed(() => this.auth.tieneAlgunRol('EMPLEADOR'));

  protected readonly abierto = computed(() => this.servicioId() !== null);

  protected readonly placeholderImage = `data:image/svg+xml;utf8,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400"><rect width="640" height="400" fill="#0d1117"/><g fill="none" stroke="#98a2b3" stroke-width="3"><rect x="220" y="110" width="200" height="150" rx="16"/><circle cx="280" cy="160" r="20"/><path d="M220 230l55-50 40 34 35-28 70 60"/></g><text x="320" y="310" text-anchor="middle" fill="#98a2b3" font-size="18" font-family="sans-serif">Sin imagen</text></svg>',
  )}`;

  private readonly recargar$ = new Subject<void>();

  constructor() {
    toObservable(this.servicioId)
      .pipe(
        switchMap((id) => {
          // Cambiar de servicio reinicia el mensaje de la última modificación
          // y cierra lo que estuviera abierto por encima.
          this.exito.set(null);
          this.editando.set(false);
          this.confirmandoEliminacion.set(false);
          return this.recargar$.pipe(startWith(undefined), map(() => id));
        }),
        switchMap((id) => this.cargarDetalle(id)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((resultado) => {
        if (!resultado) return;

        if (!resultado.ok) {
          this.servicio.set(null);
          this.error.set(this.mensajeError(resultado.error));
          this.cargando.set(false);
          this.reintentando.set(false);
          return;
        }

        this.servicio.set(resultado.servicio);
        this.error.set(null);
        this.cargando.set(false);
        this.reintentando.set(false);
      });
  }

  /** Consulta el detalle del servicio. `null` deja el modal cerrado. */
  private cargarDetalle(id: number | null): Observable<ResultadoDetalle | null> {
    if (id === null) {
      this.servicio.set(null);
      this.cargando.set(false);
      this.error.set(null);
      return of(null);
    }

    this.cargando.set(true);
    this.error.set(null);

    return this.api.obtenerPorId(id, true).pipe(
      map((servicio): ResultadoDetalle => ({ ok: true, servicio })),
      catchError((error: HttpErrorResponse) => of<ResultadoDetalle>({ ok: false, error })),
    );
  }

  protected reintentar(): void {
    if (this.reintentando()) return;
    this.reintentando.set(true);
    this.recargar$.next();
  }

  /**
   * Cierra el modal de detalle. Mientras el formulario de modificación o las
   * confirmaciones de eliminación están abiertos por encima, el detalle no se
   * cierra.
   */
  protected solicitarCierre(): void {
    if (this.editando() || this.confirmandoEliminacion()) return;
    this.cerrar.emit();
  }

  /** Abre el formulario de modificación por encima del detalle. */
  protected abrirEdicion(): void {
    if (!this.servicio()) return;
    this.exito.set(null);
    this.editando.set(true);
  }

  /** Cierra el formulario de modificación y vuelve al detalle. */
  protected cerrarEdicion(): void {
    this.editando.set(false);
  }

  /** El backend confirmó la modificación: se avisa y se refrescan los datos. */
  protected onActualizado(): void {
    this.editando.set(false);
    this.exito.set('El servicio se modificó correctamente');
    this.recargar$.next();
    // La pantalla que lista los servicios tiene que reflejar el cambio.
    this.modificado.emit();
  }

  /** Abre las confirmaciones de eliminación por encima del detalle. */
  protected abrirEliminacion(): void {
    if (!this.servicio() || !this.puedeEliminar()) return;
    this.exito.set(null);
    this.confirmandoEliminacion.set(true);
  }

  /** El empleador canceló: se vuelve al detalle del servicio. */
  protected onEliminacionCancelada(): void {
    this.confirmandoEliminacion.set(false);
  }

  /** El backend confirmó la eliminación: la pantalla refresca el listado. */
  protected onEliminado(): void {
    this.confirmandoEliminacion.set(false);
    this.eliminado.emit();
  }

  protected duracion(minutos: number | null | undefined): string {
    return formatearDuracion(minutos);
  }

  protected precio(precio: ServicioDTO['precio']): string {
    if (typeof precio === 'string' && !precio.trim()) {
      return 'Precio a consultar';
    }
    const valor = typeof precio === 'string' ? Number(precio) : precio;
    if (valor === null || valor === undefined || !Number.isFinite(valor)) {
      return 'Precio a consultar';
    }
    return FORMATO_PRECIO.format(valor);
  }

  protected foto(servicio: ServicioDTO): string {
    return servicio.fotoPerfil?.trim() || this.placeholderImage;
  }

  protected onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.onerror = null;
    img.src = this.placeholderImage;
  }

  /** El servicio tiene reseñas con las que mostrar una puntuación. */
  protected tienePuntuacion(servicio: ServicioDTO): boolean {
    const cantidad = servicio.cantidadPuntuaciones;
    return (
      typeof cantidad === 'number' &&
      Number.isFinite(cantidad) &&
      cantidad > 0 &&
      typeof servicio.puntuacion === 'number' &&
      Number.isFinite(servicio.puntuacion)
    );
  }

  /** Puntuación redondeada, la que define cuántas abejas van llenas. */
  protected puntuacion(servicio: ServicioDTO): number {
    const valor = servicio.puntuacion ?? 0;
    return Math.max(0, Math.min(MAXIMO_ABEJAS, Math.round(valor)));
  }

  /** Valor numérico de la puntuación tal como lo devuelve el backend. */
  protected valorPuntuacion(servicio: ServicioDTO): string {
    const valor = servicio.puntuacion ?? 0;
    return FORMATO_PUNTUACION.format(valor);
  }

  /** Una abeja por punto de la escala, filled cuando la posição está cubierta. */
  protected abejas(servicio: ServicioDTO): readonly boolean[] {
    if (!this.tienePuntuacion(servicio)) {
      return [];
    }
    const puntuacion = this.puntuacion(servicio);
    return Array.from({ length: MAXIMO_ABEJAS }, (_valor, posicion) => posicion < puntuacion);
  }

  protected cantidadResenas(servicio: ServicioDTO): number {
    const cantidad = servicio.cantidadPuntuaciones;
    return typeof cantidad === 'number' && Number.isFinite(cantidad) ? cantidad : 0;
  }

  private mensajeError(error: HttpErrorResponse): string {
    if (error.status === 401) {
      return 'Necesitás iniciar sesión para ver el detalle del servicio.';
    }
    if (error.status === 403) {
      return 'No tenés permisos para ver los servicios de esta sucursal.';
    }
    if (error.status === 404) {
      return 'No encontramos el servicio que estabas consultando.';
    }
    if (error.status === 0) {
      return 'No pudimos conectar con el servidor. Revisá tu conexión e intentá de nuevo.';
    }
    return 'No pudimos cargar el detalle del servicio. Intentá de nuevo en unos segundos.';
  }
}
