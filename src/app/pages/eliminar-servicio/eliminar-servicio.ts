import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { servicioService } from '../../services/servicio-service';

@Component({
  selector: 'app-eliminar-servicio',
  imports: [FormsModule],
  templateUrl: './eliminar-servicio.html',
  styleUrl: './eliminar-servicio.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EliminarServicio {
  private readonly api = inject(servicioService);

  servicioId: number | null = null;
  protected readonly eliminando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly exito = signal<string | null>(null);

  protected eliminar(): void {
    if (!this.servicioId) {
      this.error.set('Ingresá un ID de servicio.');
      return;
    }
    this.eliminando.set(true);
    this.error.set(null);
    this.api.eliminar(this.servicioId).subscribe({
      next: () => {
        this.eliminando.set(false);
        this.exito.set('Servicio eliminado correctamente.');
      },
      error: (_e: HttpErrorResponse) => {
        this.eliminando.set(false);
        this.error.set('No se pudo eliminar el servicio.');
      },
    });
  }
}
