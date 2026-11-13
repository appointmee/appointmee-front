import { DsButtonComponent } from '../../shared/ui/button/button.component';
import { DsModalComponent } from '../../shared/ui/misc/misc.component';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostBinding,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { SucursalDetalleDTO } from '../../models/sucursal';
import { authService } from '../../services/auth-service';
import { sucursalService } from '../../services/sucursal-service';

/** Paso de la confirmación de eliminación. */
type PasoEliminacion = 'confirmar' | 'definitivo';

/**
 * Confirmación de eliminación de una sucursal (US-SUC-04).
 *
 * Son dos pasos. En el primero se avisa que el procedimiento es definitivo y
 * que solo un administrador puede revertirlo; en el segundo se pide la
 * confirmación final de la sucursal elegida. El pedido al backend sale recién
 * cuando el empleador elige "Eliminar permanentemente": antes de eso no se
 * toca la sucursal.
 */
@Component({
  selector: 'app-sucursal-eliminar-modal',
  imports: [DsButtonComponent, DsModalComponent],
  templateUrl: './sucursal-eliminar-modal.html',
  styleUrl: './sucursal-eliminar-modal.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SucursalEliminarModal {
  private readonly api = inject(sucursalService);
  private readonly auth = inject(authService);
  private readonly destroyRef = inject(DestroyRef);

  /** Sucursal que se quiere eliminar. */
  readonly sucursal = input<SucursalDetalleDTO | null>(null);
  /** Define si las confirmaciones están visibles. */
  readonly abierto = input(false);
  /** Se emite cuando el usuario cancela y vuelve al detalle de la sucursal. */
  readonly cerrar = output<void>();
  /** Se emite cuando el backend confirmó la eliminación. */
  readonly eliminado = output<void>();

  /** Paso actual de la confirmación. */
  protected readonly paso = signal<PasoEliminacion>('confirmar');
  /** Indica que la eliminación está en curso. */
  protected readonly eliminando = signal(false);
  /** Mensaje de error de la última eliminación que falló. */
  protected readonly error = signal<string | null>(null);

  /**
   * Solo el empleador puede eliminar su sucursal: es el rol que autoriza el
   * endpoint `DELETE /sucursales/borrar-sucursal-propia/{sucursalId}`. El
   * backend sigue validando el permiso (y que la sucursal sea del empleador),
   * así que esto solo evita ejecutar una acción que el servidor va a rechazar.
   */
  protected readonly puedeEliminar = computed(() => this.auth.tieneAlgunRol('EMPLEADOR'));

  private readonly botonCancelar = viewChild<ElementRef<HTMLButtonElement>>('botonCancelar');
  private readonly botonCancelarDefinitivo = viewChild<ElementRef<HTMLButtonElement>>(
    'botonCancelarDefinitivo',
  );

  constructor() {
    // Cada vez que se abre la confirmación se vuelve al primer paso: nunca se
    // hereda una eliminación a medias de una ronda anterior.
    effect(() => {
      if (!this.abierto()) return;
      this.paso.set('confirmar');
      this.error.set(null);
      this.eliminando.set(false);
    });

    // El foco intenta quedar en el botón "Cancelar": la salida más segura de
    // un diálogo que elimina. La consulta de vista avisa cuando el botón ya
    // está en el DOM.
    effect(() => {
      const boton = this.botonCancelar() ?? this.botonCancelarDefinitivo();
      if (!boton) return;
      try {
        boton.nativeElement.focus();
      } catch {
        // El botón puede no estar montado todavía.
      }
    });
  }

  /**
   * El modal de detalle, que queda por debajo, marca este componente como
   * inerte para que no se pueda interactuar con lo que está atrás. Cuando las
   * confirmaciones están abiertas hay que quitarlo: si no, no podrían recibir
   * foco ni eventos.
   */
  @HostBinding('attr.inert')
  get inactivo(): string | null {
    return this.abierto() ? null : '';
  }

  /** Cierra las confirmaciones sin eliminar nada. */
  protected cancelar(): void {
    if (this.eliminando()) return;

    this.paso.set('confirmar');
    this.error.set(null);
    this.cerrar.emit();
  }

  /** Pasa a la confirmación definitiva. Todavía no se elimina nada. */
  protected continuar(): void {
    if (this.eliminando()) return;

    this.error.set(null);
    this.paso.set('definitivo');
  }

  /** Ejecuta la eliminación: recién acá se llama al backend. */
  protected confirmar(): void {
    const sucursal = this.sucursal();
    if (!sucursal || this.eliminando() || !this.puedeEliminar()) return;

    this.eliminando.set(true);
    this.error.set(null);

    this.api
      .eliminar(sucursal.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.eliminando.set(false);
          this.paso.set('confirmar');
          this.eliminado.emit();
        },
        error: (error: HttpErrorResponse) => {
          // La sucursal sigue en pie: se avisa y el usuario sigue en el
          // contexto del detalle, sin cambiar de ruta.
          this.eliminando.set(false);
          this.error.set(this.mensajeError(error));
        },
      });
  }

  /**
   * Mensaje general del error. Cuando el backend explica una regla concreta
   * (4xx) se muestra el suyo; para fallas del servidor o de red se muestra un
   * mensaje propio que no expone detalles internos.
   */
  private mensajeError(error: HttpErrorResponse): string {
    if (error.status === 0) {
      return 'No pudimos conectarnos con el servidor. Revisá tu conexión e intentá de nuevo.';
    }
    if (error.status === 401) {
      return 'Tu sesión expiró. Volvé a iniciar sesión para eliminar la sucursal.';
    }
    if (error.status === 403) {
      return 'No tenés permisos para eliminar esta sucursal.';
    }
    if (error.status === 404) {
      return 'No encontramos la sucursal que querés eliminar.';
    }
    if (error.status === 409) {
      return 'La sucursal no se pudo eliminar porque tiene datos en conflicto.';
    }
    if (error.status === 429) {
      return 'Demasiados intentos. Esperá unos segundos e intentá de nuevo.';
    }
    if (error.status >= 500) {
      return 'Tuvimos un problema al eliminar la sucursal. Probá de nuevo en unos segundos.';
    }
    return 'No pudimos eliminar la sucursal. Intentá de nuevo en unos segundos.';
  }
}
