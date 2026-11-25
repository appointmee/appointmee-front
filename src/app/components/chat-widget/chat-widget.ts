import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  afterRenderEffect,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';

import { Chat } from '../../pages/chat/chat';
import { authService } from '../../services/auth-service';
import { chatWidgetService } from '../../services/chat-widget-service';
import { DsButtonComponent } from '../../shared/ui/button/button.component';

const ICONO_CERRAR = 'M6 6l12 12M18 6 6 18';
const CLAVE_ABEJA_VISTA = 'appointmee.chat-abeja-vista';

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
  protected readonly iconoCerrar = ICONO_CERRAR;

  protected readonly puedeChatear = computed(
    () =>
      this.auth.autenticado() &&
      this.auth.tieneAlgunRol('CLIENTE', 'EMPLEADO', 'EMPLEADOR'),
  );

  protected readonly etiquetaBurbuja = computed(() =>
    this.widget.abierto() ? 'Cerrar mensajes' : 'Abrir mensajes',
  );

  /** Animación de bienvenida: una abeja vuela hasta la burbuja del chat. */
  protected readonly abejaVisible = signal(false);
  private animacionIniciada = false;
  /** `?abeja=1` permite volver a ver la animación durante el desarrollo. */
  private readonly forzarAbeja =
    new URLSearchParams(window.location.search).get('abeja') === '1';

  constructor() {
    // El botón de cierre se crea junto con el panel: se enfoca después del render.
    afterRenderEffect(() => {
      if (this.widget.abierto() && this.widget.debeEnfocar()) {
        this.widget.consumirEnfoque();
        this.botonCerrar()?.focus();
      }
    });

    effect(() => {
      if (this.animacionIniciada || !this.puedeChatear() || this.widget.abierto()) return;
      this.animacionIniciada = true;
      this.mostrarAbejaSiCorresponde();
    });
  }

  protected toggle(): void {
    if (!this.puedeChatear()) return;

    if (this.widget.abierto()) {
      this.cerrar();
      return;
    }

    if (this.abejaVisible()) this.marcarAbejaVista();
    this.abejaVisible.set(false);
    this.widget.abrirConEnfoque();
  }

  protected onFinAbeja(event: AnimationEvent): void {
    if (event.animationName === 'abeja-bzz') {
      this.abejaVisible.set(false);
      this.marcarAbejaVista();
    }
  }

  private mostrarAbejaSiCorresponde(): void {
    if (!this.forzarAbeja) {
      try {
        if (sessionStorage.getItem(CLAVE_ABEJA_VISTA)) return;
      } catch {
        return;
      }
    }

    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      this.marcarAbejaVista();
      return;
    }
    this.abejaVisible.set(true);
  }

  private marcarAbejaVista(): void {
    try {
      sessionStorage.setItem(CLAVE_ABEJA_VISTA, '1');
    } catch {
      // sessionStorage puede estar bloqueado: no es crítico para la animación.
    }
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
