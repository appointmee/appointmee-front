import { Injectable, signal } from '@angular/core';

/** Estado de apertura del widget de mensajes, compartido entre el navbar y el widget flotante. */
@Injectable({ providedIn: 'root' })
export class chatWidgetService {
  private readonly estado = signal(false);
  private readonly pendienteEnfoque = signal(false);
  private readonly conversacion = signal<number | null>(null);

  readonly abierto = this.estado.asReadonly();
  readonly debeEnfocar = this.pendienteEnfoque.asReadonly();
  readonly conversacionId = this.conversacion.asReadonly();

  abrir(): void {
    this.estado.set(true);
  }

  /** Abre el panel y pide que el foco se mueva a su botón de cierre tras el render. */
  abrirConEnfoque(): void {
    this.pendienteEnfoque.set(true);
    this.estado.set(true);
  }

  /** Abre el panel pidiendo seleccionar una conversación concreta (por ejemplo, desde una notificación). */
  abrirConversacion(conversacionId: number): void {
    this.conversacion.set(conversacionId);
    this.abrirConEnfoque();
  }

  consumirConversacion(): void {
    this.conversacion.set(null);
  }

  consumirEnfoque(): void {
    this.pendienteEnfoque.set(false);
  }

  cerrar(): void {
    this.estado.set(false);
    this.pendienteEnfoque.set(false);
    this.conversacion.set(null);
  }

  toggle(): void {
    if (this.estado()) this.cerrar();
    else this.abrirConEnfoque();
  }
}
