import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';

import { SucursalForm } from '../../components/sucursal-form/sucursal-form';
import { SucursalFormDatos } from '../../components/sucursal-form/sucursal-form.model';
import { sucursalService } from '../../services/sucursal-service';

/**
 * Alta de sucursal (US-SUC-01).
 *
 * El formulario (campos, validaciones y mensajes) vive en el componente
 * compartido `SucursalForm`, que también usa el recuadro de modificación
 * (US-SUC-02). Esta pantalla solo se ocupa de enviar los datos al backend y
 * de avisar el resultado.
 */
@Component({
  selector: 'app-crear-sucursal',
  imports: [RouterLink, SucursalForm],
  templateUrl: './crear-sucursal.html',
  styleUrl: './crear-sucursal.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CrearSucursalPage {
  private readonly api = inject(sucursalService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  /** La pantalla está guardando la sucursal. */
  cargando = signal(false);
  /** Error general de la creación. */
  error = signal<string | null>(null);
  /** Mensaje de éxito de la creación. */
  exito = signal<string | null>(null);

  private readonly formularioSucursal = viewChild.required(SucursalForm);

  /**
   * Estado del formulario. Lo maneja el componente compartido; la pantalla lo
   * consulta para poder leer y setear los valores como antes.
   */
  get model() {
    return this.formularioSucursal().model;
  }

  get formulario() {
    return this.formularioSucursal().formulario;
  }

  get fotoUrl() {
    return this.formularioSucursal().fotoUrl;
  }

  /** Envía el formulario: valida los datos y crea la sucursal. */
  onSubmit(event: Event): void {
    event.preventDefault();
    this.formularioSucursal().enviarFormulario();
  }

  /** El formulario ya validó los datos: se envían al backend. */
  protected onEnviar(datos: SucursalFormDatos): void {
    this.cargando.set(true);
    this.error.set(null);
    this.exito.set(null);

    this.api
      .crear({
        ...datos,
        // En el alta la foto es obligatoria: el formulario no deja enviar sin ella.
        fotoUrl: datos.fotoUrl ?? '',
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.cargando.set(false);
          this.exito.set('Se ha creado la sucursal con exito');
          setTimeout(() => {
            void this.router.navigateByUrl('/mis-sucursales');
          }, 2000);
        },
        error: (err: any) => {
          this.cargando.set(false);
          const mensaje =
            (typeof err?.error === 'string' && err.error) ||
            err?.error?.message ||
            err?.message ||
            'No pudimos crear la sucursal. Intentá de nuevo.';
          this.error.set(mensaje);
        },
      });
  }
}
