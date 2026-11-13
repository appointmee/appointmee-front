import { DsModalComponent } from '../../shared/ui/misc/misc.component';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostBinding,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { SucursalModificarPayload, SucursalDetalleDTO } from '../../models/sucursal';
import { sucursalService } from '../../services/sucursal-service';
import {
  CAMPOS_SUCURSAL,
  mapearErroresFormulario,
  normalizarCampoSucursal,
} from '../../shared/errores-formulario';
import { SucursalForm } from '../sucursal-form/sucursal-form';
import { SucursalFormDatos, SucursalFormModel } from '../sucursal-form/sucursal-form.model';

/**
 * Recuadro de modificación de una sucursal (US-SUC-02).
 *
 * Contiene el mismo formulario que el alta de sucursales (componente
 * `SucursalForm`), con los datos de la sucursal ya cargados. Si el
 *aporador cambia algo y cierra el recuadro, se le pide confirmación antes de
 * perder los cambios.
 */
@Component({
  selector: 'app-sucursal-editar-modal',
  imports: [DsModalComponent, SucursalForm],
  templateUrl: './sucursal-editar-modal.html',
  styleUrl: './sucursal-editar-modal.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SucursalEditarModal {
  private readonly api = inject(sucursalService);
  private readonly destroyRef = inject(DestroyRef);

  /** Sucursal que se está modificando. */
  readonly sucursal = input<SucursalDetalleDTO | null>(null);
  /** Define si el formulario está visible. */
  readonly abierto = input(false);
  /** Se emite cuando el usuario cierra el formulario. */
  readonly cerrar = output<void>();
  /** Se emite cuando el backend confirmó la modificación de la sucursal. */
  readonly actualizado = output<void>();

  /** Se está guardando la sucursal. */
  protected readonly guardando = signal(false);
  /** Errores del backend por campo. */
  protected readonly erroresCampos = signal<Record<string, string>>({});
  /** Error general de la modificación. */
  protected readonly errorGeneral = signal<string | null>(null);

  /**
   * El recuadro de detalle, que queda por debajo, marca este componente como
   * inerte para que no se pueda interactuar con lo que está atrás. Cuando el
   * formulario se abre hay que quitarlo: si no, no podría recibir foco ni
   * eventos.
   */
  @HostBinding('attr.inert')
  get inactivo(): string | null {
    return this.abierto() ? null : '';
  }

  private readonly formulario = viewChild(SucursalForm);

  /** Valores con los que se precarga el formulario. */
  protected readonly valoresFormulario = computed<SucursalFormModel>(() => {
    const sucursal = this.sucursal();
    return {
      nombre: sucursal?.nombre ?? '',
      direccion: sucursal?.direccion ?? '',
      telefono: sucursal?.telefono ?? '',
      descripcion: sucursal?.descripcion ?? '',
      categoria: sucursal?.categoria ?? '',
      horaApertura: sucursal?.horaApertura ?? '',
      horaCierre: sucursal?.horaCierre ?? '',
      diasApertura: [...(sucursal?.diasApertura ?? [])],
    };
  });

  /** Foto vigente de la sucursal: se conserva si no se elige una nueva. */
  protected readonly fotoVigente = computed(() => this.sucursal()?.fotoPerfil ?? null);

  /**
   * Cierra el formulario. Si hubo cambios se pide confirmación antes de
   * descartarlos; si no, se cierra directamente.
   */
  solicitarCierre(): void {
    if (this.guardando()) return;
    this.formulario()?.solicitarCierre();
  }

  /** El formulario tiene cambios sin guardar. */
  tieneCambios(): boolean {
    return this.formulario()?.tieneCambios() ?? false;
  }

  /** El formulario se cerró: se cierra el recuadro. */
  protected cerrarFormulario(): void {
    this.cerrar.emit();
  }

  /** El formulario validó los datos: se envían al backend. */
  protected onEnviar(datos: SucursalFormDatos): void {
    const sucursal = this.sucursal();
    if (!sucursal || this.guardando()) return;

    this.guardando.set(true);
    this.erroresCampos.set({});
    this.errorGeneral.set(null);

    this.api
      .actualizar(sucursal.id, this.construirPayload(datos))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.guardando.set(false);
          this.cerrar.emit();
          this.actualizado.emit();
        },
        error: (err: unknown) => {
          this.guardando.set(false);
          const { campos, general } = mapearErroresFormulario(
            err,
            (status) => this.mensajeErrorModificacion(status),
            { campos: CAMPOS_SUCURSAL, normalizar: normalizarCampoSucursal },
          );
          this.erroresCampos.set(campos);
          this.errorGeneral.set(general);
        },
      });
  }

  /**
   * Arma la petición con los datos del formulario. La foto solo viaja cuando
   * se eligió una imagen nueva: si no, el backend conserva la que ya tiene.
   */
  private construirPayload(datos: SucursalFormDatos): SucursalModificarPayload {
    const payload: {
      nombre: string;
      direccion: string | null;
      telefono: string | null;
      descripcion: string | null;
      categoriaId: number;
      horaApertura: string | null;
      horaCierre: string | null;
      diasApertura: readonly string[];
      fotoUrl?: string;
      fotoPublicId?: string | null;
    } = {
      nombre: datos.nombre,
      direccion: datos.direccion,
      telefono: datos.telefono,
      descripcion: datos.descripcion,
      categoriaId: datos.categoriaId,
      horaApertura: datos.horaApertura,
      horaCierre: datos.horaCierre,
      diasApertura: datos.diasApertura,
    };

    if (datos.fotoUrl) {
      payload.fotoUrl = datos.fotoUrl;
      payload.fotoPublicId = datos.fotoPublicId;
    }

    return payload;
  }

  /**
   * Mensaje general del error. Cuando el backend explica una regla concreta
   * (4xx) se muestra el suyo; para fallas del servidor o de red se muestra un
   * mensaje propio que no expone detalles internos.
   */
  private mensajeErrorModificacion(status: number): string {
    if (status === 0) {
      return 'No pudimos conectarnos con el servidor. Revisá tu conexión e intentá de nuevo.';
    }
    if (status === 403) {
      return 'No tenés permisos para modificar esta sucursal.';
    }
    if (status === 404) {
      return 'No encontramos la sucursal que querés modificar.';
    }
    if (status === 409) {
      return 'No pudimos guardar los cambios porque la dirección ya existe en otra sucursal.';
    }
    if (status === 413) {
      return 'La imagen no puede superar los 5 MB.';
    }
    if (status === 429) {
      return 'Demasiados intentos. Esperá unos segundos e intentá de nuevo.';
    }
    if (status >= 500) {
      return 'Tuvimos un problema al modificar la sucursal. Probá de nuevo en unos segundos.';
    }
    return 'No pudimos modificar la sucursal. Revisá los datos e intentá de nuevo.';
  }
}
