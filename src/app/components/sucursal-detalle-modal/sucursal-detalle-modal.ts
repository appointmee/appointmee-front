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
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Observable, Subject, of } from 'rxjs';
import { catchError, map, startWith, switchMap } from 'rxjs/operators';

import { SucursalDetalleDTO } from '../../models/sucursal';
import { humanizarCategoria } from '../../models/solicitud-empleado';
import { authService } from '../../services/auth-service';
import { sucursalService } from '../../services/sucursal-service';
import { ABREVIATURAS_DIAS, DIAS_SUCURSAL } from '../sucursal-form/sucursal-form.model';
import { SucursalEditarModal } from '../sucursal-editar-modal/sucursal-editar-modal';
import { SucursalEliminarModal } from '../sucursal-eliminar-modal/sucursal-eliminar-modal';

/** Nombres de día que acepta el backend, traducidos al día de la semana. */
const DIAS_ACEPTADOS: Readonly<Record<string, string>> = {
  MONDAY: 'MONDAY',
  LUNES: 'MONDAY',
  TUESDAY: 'TUESDAY',
  MARTES: 'TUESDAY',
  WEDNESDAY: 'WEDNESDAY',
  MIERCOLES: 'WEDNESDAY',
  'MIÉRCOLES': 'WEDNESDAY',
  THURSDAY: 'THURSDAY',
  JUEVES: 'THURSDAY',
  FRIDAY: 'FRIDAY',
  VIERNES: 'FRIDAY',
  SATURDAY: 'SATURDAY',
  SABADO: 'SATURDAY',
  'SÁBADO': 'SATURDAY',
  SUNDAY: 'SUNDAY',
  DOMINGO: 'SUNDAY',
};

/** Resultado de consultar el detalle de una sucursal. */
type ResultadoDetalle =
  | { readonly ok: true; readonly sucursal: SucursalDetalleDTO }
  | { readonly ok: false; readonly error: HttpErrorResponse };

/**
 * Recuadro con la información de la sucursal (US-SUC-02).
 *
 * Consulta el mismo endpoint que usa el detalle público
 * (`GET /sucursales/{id}`) y muestra los datos de la sucursal. Desde acá se
 * abre el formulario de modificación, que queda por encima de este recuadro.
 */
@Component({
  selector: 'app-sucursal-detalle-modal',
  imports: [
    DsButtonComponent,
    DsModalComponent,
    RouterLink,
    SucursalEditarModal,
    SucursalEliminarModal,
  ],
  templateUrl: './sucursal-detalle-modal.html',
  styleUrl: './sucursal-detalle-modal.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SucursalDetalleModal {
  private readonly api = inject(sucursalService);
  private readonly auth = inject(authService);
  private readonly destroyRef = inject(DestroyRef);

  /** Identificador de la sucursal a mostrar. `null` mantiene el recuadro cerrado. */
  readonly sucursalId = input<number | null>(null);
  /** En administración solo se permite consultar y dar de baja la sucursal. */
  readonly modo = input<'empleador' | 'administrador'>('empleador');
  /** Se emite cuando el usuario pide cerrar el recuadro. */
  readonly cerrar = output<void>();
  /** Se emite cuando la sucursal fue modificada y hay que refrescar los datos. */
  readonly modificado = output<void>();
  /** Se emite cuando la sucursal fue eliminada y hay que refrescar el listado. */
  readonly eliminado = output<void>();
  /** Se emite con el ID de la sucursal cuando el administrador la dio de baja. */
  readonly eliminada = output<number>();

  protected readonly sucursal = signal<SucursalDetalleDTO | null>(null);
  protected readonly cargando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly reintentando = signal(false);
  protected readonly exito = signal<string | null>(null);
  /** Indica que el formulario de modificación está abierto por encima. */
  protected readonly editando = signal(false);
  /** Indica que las confirmaciones de eliminación están abiertas por encima. */
  protected readonly confirmandoEliminacion = signal(false);
  /**
   * Solo el empleador puede eliminar su sucursal: es el rol que autoriza el
   * endpoint `DELETE /sucursales/borrar-sucursal-propia/{sucursalId}`. El
   * backend sigue validando el permiso (y que la sucursal sea del empleador),
   * así que esto solo evita mostrar una acción que el servidor va a rechazar.
   */
  protected readonly puedeEliminar = computed(() => this.auth.tieneAlgunRol('EMPLEADOR'));
  protected readonly eliminando = signal(false);
  protected readonly errorEliminacion = signal<string | null>(null);

  protected readonly dias = DIAS_SUCURSAL;
  protected readonly abreviaturas = ABREVIATURAS_DIAS;

  protected readonly placeholderImage = `data:image/svg+xml;utf8,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400"><rect width="640" height="400" fill="#0d1117"/><g fill="none" stroke="#98a2b3" stroke-width="3"><rect x="220" y="110" width="200" height="150" rx="16"/><circle cx="280" cy="160" r="20"/><path d="220 230l55-50 40 34 35-28 70 60"/></g><text x="320" y="310" text-anchor="middle" fill="#98a2b3" font-size="18" font-family="sans-serif">Sin imagen</text></svg>',
  )}`;

  private readonly recargar$ = new Subject<void>();

  /** Formulario de modificación, que se abre por encima del recuadro. */
  private readonly edicion = viewChild(SucursalEditarModal);

  /** Categoría de la sucursal, con el formato que usa el resto de la aplicación. */
  protected readonly categoria = computed(() => humanizarCategoria(this.sucursal()?.categoria));

  /** Teléfono de la sucursal: puede no tener uno cargado. */
  protected readonly telefono = computed(() => this.sucursal()?.telefono?.trim() ?? '');

  /** Horario de atención, con el formato "10:00 - 02:00". */
  protected readonly horario = computed(() => {
    const sucursal = this.sucursal();
    const apertura = sucursal?.horaApertura?.trim() ?? '';
    const cierre = sucursal?.horaCierre?.trim() ?? '';
    if (!apertura || !cierre) return null;
    return `${apertura} - ${cierre}`;
  });

  /** Puntuación promedio, redondeada a un decimal. */
  protected readonly puntuacion = computed(() => {
    const valor = this.sucursal()?.puntuacion;
    return typeof valor === 'number' && Number.isFinite(valor)
      ? Math.round(Math.max(0, Math.min(5, valor)) * 10) / 10
      : 0;
  });

  /** Cantidad de reseñas de la sucursal. */
  protected readonly cantidadResenias = computed(() => {
    const valor = this.sucursal()?.cantidadPuntuaciones;
    return typeof valor === 'number' && Number.isFinite(valor) && valor > 0 ? valor : 0;
  });

  /** Una abeja por punto de la escala: filled cuando la posición está cubierta. */
  protected readonly abejas = computed(() =>
    [1, 2, 3, 4, 5].map((posicion) => posicion <= this.puntuacion()),
  );

  /** La sucursal tiene reseñas con las que mostrar una puntuación. */
  protected readonly tienePuntuacion = computed(
    () => this.cantidadResenias() > 0 && this.sucursal()?.puntuacion !== null,
  );

  constructor() {
    toObservable(this.sucursalId)
      .pipe(
        switchMap((id) => {
          // Cambiar de sucursal reinicia el mensaje de la última modificación
          // y cierra lo que estuviera abierto por encima.
          this.exito.set(null);
          this.editando.set(false);
          this.confirmandoEliminacion.set(false);
          this.eliminando.set(false);
          this.errorEliminacion.set(null);
          return this.recargar$.pipe(startWith(undefined), map(() => id));
        }),
        switchMap((id) => this.cargarDetalle(id)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((resultado) => {
        if (!resultado) return;

        if (!resultado.ok) {
          this.sucursal.set(null);
          this.error.set(this.mensajeError(resultado.error));
          this.cargando.set(false);
          this.reintentando.set(false);
          return;
        }

        this.sucursal.set(resultado.sucursal);
        this.error.set(null);
        this.cargando.set(false);
        this.reintentando.set(false);
      });
  }

  /** Consulta el detalle de la sucursal. `null` deja el recuadro cerrado. */
  private cargarDetalle(id: number | null): Observable<ResultadoDetalle | null> {
    if (id === null) {
      this.sucursal.set(null);
      this.cargando.set(false);
      this.error.set(null);
      return of(null);
    }

    this.cargando.set(true);
    this.error.set(null);

    return this.api.obtenerPorId(id, true).pipe(
      map((sucursal): ResultadoDetalle => ({ ok: true, sucursal })),
      catchError((error: HttpErrorResponse) => of<ResultadoDetalle>({ ok: false, error })),
    );
  }

  protected reintentar(): void {
    if (this.reintentando()) return;
    this.reintentando.set(true);
    this.recargar$.next();
  }

  /**
   * Cierra el recuadro de detalle. Mientras el formulario de modificación o
   * las confirmaciones de eliminación están abiertos por encima, el detalle
   * no se cierra.
   */
  protected solicitarCierre(): void {
    if (this.editando() || this.confirmandoEliminacion() || this.eliminando()) return;
    this.confirmandoEliminacion.set(false);
    this.errorEliminacion.set(null);
    this.cerrar.emit();
  }

  protected solicitarEliminacion(): void {
    if (this.modo() !== 'administrador' || !this.sucursal() || this.eliminando()) return;
    this.errorEliminacion.set(null);
    this.confirmandoEliminacion.set(true);
  }

  protected cancelarEliminacion(): void {
    if (this.eliminando()) return;
    this.confirmandoEliminacion.set(false);
    this.errorEliminacion.set(null);
  }

  protected confirmarEliminacion(): void {
    const id = this.sucursal()?.id;
    if (this.modo() !== 'administrador' || id === undefined || this.eliminando()) return;

    this.eliminando.set(true);
    this.errorEliminacion.set(null);
    this.api
      .eliminarComoAdministrador(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.eliminando.set(false);
          this.confirmandoEliminacion.set(false);
          this.eliminada.emit(id);
          this.cerrar.emit();
        },
        error: (error: HttpErrorResponse) => {
          this.eliminando.set(false);
          this.errorEliminacion.set(this.mensajeErrorEliminacion(error));
        },
      });
  }

  /** Abre el formulario de modificación por encima del detalle. */
  protected abrirEdicion(): void {
    if (!this.sucursal()) return;
    this.exito.set(null);
    this.editando.set(true);
  }

  /** Cierra el formulario de modificación y vuelve al detalle. */
  protected cerrarEdicion(): void {
    this.editando.set(false);
  }

  /** Abre las confirmaciones de eliminación por encima del detalle. */
  protected abrirEliminacion(): void {
    if (!this.sucursal() || !this.puedeEliminar()) return;
    this.exito.set(null);
    this.confirmandoEliminacion.set(true);
  }

  /** El empleador canceló: se vuelve al detalle de la sucursal. */
  protected onEliminacionCancelada(): void {
    this.confirmandoEliminacion.set(false);
  }

  /** El backend confirmó la eliminación: la pantalla refresca el listado. */
  protected onEliminado(): void {
    this.confirmandoEliminacion.set(false);
    this.eliminado.emit();
  }

  /**
   * El formulario de edición tiene cambios sin guardar: el recuadro avisa
   * para que se pida confirmación antes de perderlos.
   */
  tieneCambiosSinGuardar(): boolean {
    if (!this.editando()) return false;
    return this.edicion()?.tieneCambios() ?? false;
  }

  /** Pide al formulario de modificación que cierre y confirme si hace falta. */
  solicitarCierreEdicion(): void {
    if (!this.editando()) return;
    this.edicion()?.solicitarCierre();
  }

  /**
   * El backend confirmó la modificación: se avisa y se vuelven a consultar los
   * datos para que el recuadro muestre la sucursal ya actualizada.
   */
  protected onActualizado(): void {
    this.editando.set(false);
    this.exito.set('Cambios guardados');
    this.recargar$.next();
    this.modificado.emit();
  }

  /** El día está marcado como día de apertura. */
  protected abre(dia: string): boolean {
    const apertura = this.sucursal()?.diasApertura ?? [];
    return apertura.some((nombre) => DIAS_ACEPTADOS[nombre?.trim().toUpperCase()] === dia);
  }

  /** Abreviatura del día (LU, MA, MI…). */
  protected abreviatura(dia: string): string {
    return this.abreviaturas[dia] ?? dia;
  }

  /** Foto de perfil de la sucursal, o una imagen de reemplazo. */
  protected foto(): string {
    return this.sucursal()?.fotoPerfil?.trim() || this.placeholderImage;
  }

  protected onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.onerror = null;
    img.src = this.placeholderImage;
  }

  /** Fecha de creación de la sucursal, en formato DD/MM/AAAA. */
  protected fecha(fecha: string | null | undefined): string {
    const valor = fecha?.trim();
    if (!valor) return 'Fecha no disponible';

    const partes = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor);
    if (!partes) return valor;

    const [, anio, mes, dia] = partes;
    return `${dia}/${mes}/${anio}`;
  }

  private mensajeError(error: HttpErrorResponse): string {
    if (error.status === 401) {
      return 'Necesitás iniciar sesión para ver los datos de la sucursal.';
    }
    if (error.status === 403) {
      return 'No tenés permisos para ver los datos de esta sucursal.';
    }
    if (error.status === 404) {
      return 'No encontramos la sucursal que estabas consultando.';
    }
    if (error.status === 0) {
      return 'No pudimos conectar con el servidor. Revisá tu conexión e intentá de nuevo.';
    }
    return 'No pudimos cargar los datos de la sucursal. Intentá de nuevo en unos segundos.';
  }

  private mensajeErrorEliminacion(error: HttpErrorResponse): string {
    if (error.status === 0) return 'No pudimos conectar con el servidor. Revisá tu conexión e intentá de nuevo.';
    if (error.status === 401) return 'Tu sesión expiró. Volvé a iniciar sesión para eliminar la sucursal.';
    if (error.status === 403) return 'No tenés permisos para eliminar esta sucursal.';
    if (error.status === 404) return 'No encontramos la sucursal que querés eliminar.';
    if (error.status >= 500) return 'Tuvimos un problema al eliminar la sucursal. Probá de nuevo en unos segundos.';
    return 'No pudimos eliminar la sucursal. Intentá de nuevo en unos segundos.';
  }
}
