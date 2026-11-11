import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { sucursalService } from '../../services/sucursal-service';

@Component({
  selector: 'app-agregarme-empleado',
  imports: [FormsModule],
  templateUrl: './agregarme-empleado.html',
  styleUrl: './agregarme-empleado.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgregarmeEmpleado {
  private readonly api = inject(sucursalService);

  sucursalId: number | null = null;
  email = '';
  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly exito = signal<string | null>(null);

  protected enviar(): void {
    if (!this.sucursalId || !this.email.trim()) {
      this.error.set('Completá los campos.');
      return;
    }
    this.guardando.set(true);
    this.error.set(null);
    this.api.agregarEmpleado(this.sucursalId, this.email.trim()).subscribe({
      next: () => { this.guardando.set(false); this.exito.set('Solicitud enviada.'); },
      error: (_e: HttpErrorResponse) => { this.guardando.set(false); this.error.set('No se pudo enviar.'); },
    });
  }
}
