import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  afterRenderEffect,
  computed,
  inject,
} from '@angular/core';

import { Chat } from '../../pages/chat/chat';
import { authService } from '../../services/auth-service';
import { chatWidgetService } from '../../services/chat-widget-service';
import { DsButtonComponent } from '../../shared/ui/button/button.component';

const ICONO_MENSAJE = 'M21 12a8 8 0 0 1-8 8H8l-5 3 1.6-4.4A8 8 0 1 1 21 12Z';
const ICONO_CERRAR = 'M6 6l12 12M18 6 6 18';

/** Widget flotante de mensajes, disponible en todas las páginas para los roles que chatean. */
@Component({
  selector: 'app-chat-widget',
  imports: [Chat, DsButtonComponent],
  templateUrl: './chat-widget.html',
  styleUrl: './chat-widget.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatWidget {
  private readonly auth = inject(authService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly widget = inject(chatWidgetService);
  protected readonly iconoMensaje = ICONO_MENSAJE;
  protected readonly iconoCerrar = ICONO_CERRAR;

  protected readonly puedeChatear = computed(
    () =>
      this.auth.autenticado() &&
      this.auth.tieneAlgunRol('CLIENTE', 'EMPLEADO', 'EMPLEADOR'),
  );

  protected readonly etiquetaBurbuja = computed(() =>
    this.widget.abierto() ? 'Cerrar mensajes' : 'Abrir mensajes',
  );

  constructor() {
    // El botón de cierre se crea junto con el panel: se enfoca después del render.
    afterRenderEffect(() => {
      if (this.widget.abierto() && this.widget.debeEnfocar()) {
        this.widget.consumirEnfoque();
        this.botonCerrar()?.focus();
      }
    });
  }

  protected toggle(): void {
    if (!this.puedeChatear()) return;

    if (this.widget.abierto()) {
      this.cerrar();
      return;
    }

    this.widget.abrirConEnfoque();
  }

  protected cerrar(devolverFoco: boolean = true): void {
    if (!this.widget.abierto()) return;

    this.widget.cerrar();
    if (devolverFoco) this.burbuja()?.focus();
  }

  private burbuja(): HTMLButtonElement | null {
    return this.host.nativeElement.querySelector<HTMLButtonElement>('.chat-widget__burbuja');
  }

  private botonCerrar(): HTMLButtonElement | null {
    return this.host.nativeElement.querySelector<HTMLButtonElement>('.chat-widget__cerrar');
  }

  @HostListener('document:keydown', ['$event'])
  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.widget.abierto()) {
      this.cerrar();
    }
  }
}
