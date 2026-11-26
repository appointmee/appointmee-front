import { Injectable, signal } from '@angular/core';

/**
 * Señal compartida entre el panel del navbar y la vista /notificaciones.
 * Cada marcado como leída incrementa la versión y ambas vistas recargan,
 * de modo que no queden listados distintos para el mismo usuario.
 */
@Injectable({ providedIn: 'root' })
export class notificacionesCambiosService {
  private readonly versionInterna = signal(0);

  readonly version = this.versionInterna.asReadonly();

  notificarCambio(): void {
    this.versionInterna.update((version) => version + 1);
  }
}
