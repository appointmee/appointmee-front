import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  afterRenderEffect,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { gsap } from 'gsap';

import { Chat } from '../../pages/chat/chat';
import { authService } from '../../services/auth-service';
import { chatWidgetService } from '../../services/chat-widget-service';
import { DsButtonComponent } from '../../shared/ui/button/button.component';

const ICONO_MENSAJE = 'M21 12a8 8 0 0 1-8 8H8l-5 3 1.6-4.4A8 8 0 1 1 21 12Z';
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
export class ChatWidget implements OnDestroy {
  private readonly auth = inject(authService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly widget = inject(chatWidgetService);
  protected readonly iconoMensaje = ICONO_MENSAJE;
  protected readonly iconoCerrar = ICONO_CERRAR;

  protected readonly puedeChatear = computed(
    () =>
      this.auth.autenticado() &&
      this.auth.tieneAlgunRol('CLIENTE', 'EMPLEADO', 'EMPLEADOR', 'ADMINISTRADOR'),
  );

  protected readonly etiquetaBurbuja = computed(() =>
    this.widget.abierto() ? 'Cerrar mensajes' : 'Abrir mensajes',
  );

  /** Contenedor detrás de la burbuja que se expande hacia la izquierda al pasar el mouse. */
  protected readonly expandido = signal(false);

  /** Animación de bienvenida: una abeja vuela hasta la burbuja del chat. */
  protected readonly abejaVisible = signal(false);
  private animacionIniciada = false;
  private panelAnimado = false;
  /** `?abeja=1` permite volver a ver la animación durante el desarrollo. */
  private readonly forzarAbeja =
    new URLSearchParams(window.location.search).get('abeja') === '1';

  constructor() {
    // El botón de cierre se crea junto con el panel: se enfoca al animar su entrada.
    afterRenderEffect(() => {
      if (this.widget.abierto() && this.widget.debeEnfocar()) this.widget.consumirEnfoque();
    });

    afterRenderEffect(() => {
      if (!this.widget.abierto()) {
        this.panelAnimado = false;
        return;
      }
      if (this.panelAnimado) return;
      this.panelAnimado = true;
      this.animarEntradaPanel();
    });

    effect(() => {
      if (this.animacionIniciada || !this.puedeChatear() || this.widget.abierto()) return;
      this.animacionIniciada = true;
      this.mostrarAbejaSiCorresponde();
    });
  }

  ngOnDestroy(): void {
    const elementos = [this.burbuja(), this.peek(), this.abejaDelPeek()].filter(
      (elemento): elemento is HTMLElement => !!elemento,
    );
    gsap.killTweensOf(elementos);
  }

  @HostListener('mouseenter')
  protected onWidgetEnter(): void {
    if (this.puedeChatear() && !this.widget.abierto()) this.desplegar();
  }

  @HostListener('mouseleave')
  protected onWidgetLeave(): void {
    // Con el chat abierto el contenedor se mantiene hasta que se cierre.
    if (!this.widget.abierto()) this.plegar();
  }

  protected onBurbujaEnter(): void {
    this.animarBurbuja({ scale: 1.12, rotation: -8, duration: 0.35, ease: 'back.out(2)' });
  }

  protected onBurbujaLeave(): void {
    this.animarBurbuja({ scale: 1, rotation: 0, duration: 0.35, ease: 'power2.out' });
  }

  protected onBurbujaDown(): void {
    this.animarBurbuja({ scale: 0.88, duration: 0.12, ease: 'power2.in', overwrite: true });
  }

  protected onBurbujaUp(): void {
    this.animarBurbuja({ scale: 1.12, rotation: -8, duration: 0.3, ease: 'back.out(2)' });
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
    if (event.animationName === 'abeja-vuelo') {
      this.abejaVisible.set(false);
      this.marcarAbejaVista();
    }
  }

  private peek(): HTMLElement | null {
    return this.host.nativeElement.querySelector<HTMLElement>('.chat-widget__peek-wrap');
  }

  private abejaDelPeek(): HTMLElement | null {
    return this.host.nativeElement.querySelector<HTMLElement>('.chat-widget__peek-abeja');
  }

  private textoDelPeek(): HTMLElement | null {
    return this.host.nativeElement.querySelector<HTMLElement>('.chat-widget__peek');
  }

  private desplegar(): void {
    if (this.expandido()) return;

    const peek = this.peek();
    const abeja = this.abejaDelPeek();
    const texto = this.textoDelPeek();
    if (!peek) return;

    this.expandido.set(true);
    const ancho = Math.min(220, window.innerWidth - 80);
    const elementos = [peek, abeja, texto];
    gsap.killTweensOf(elementos);

    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      gsap.set(peek, { width: ancho, opacity: 1, scale: 1 });
      gsap.set(abeja, { opacity: 1, x: 0, y: 0, rotation: 0, scale: 1 });
      gsap.set(texto, { opacity: 1, x: 0 });
      return;
    }

    const linea = gsap.timeline();
    linea
      .fromTo(
        peek,
        { width: 0, opacity: 0, scale: 0.9, transformOrigin: 'right center' },
        { width: ancho, opacity: 1, scale: 1, duration: 0.65, ease: 'elastic.out(1, 0.75)' },
      )
      .fromTo(
        texto,
        { x: 14, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.35, ease: 'power2.out' },
        0.25,
      );

    if (abeja) {
      linea
        .fromTo(
          abeja,
          { x: -42, y: 10, rotation: -65, opacity: 0, scale: 0.6 },
          { x: 0, y: 0, rotation: 0, opacity: 1, scale: 1, duration: 0.6, ease: 'back.out(3)' },
          0.05,
        )
        .to(abeja, {
          rotation: 10,
          duration: 0.12,
          repeat: 3,
          yoyo: true,
          ease: 'sine.inOut',
        });
    }
  }

  private plegar(inmediato: boolean = false): void {
    if (!this.expandido()) return;

    const peek = this.peek();
    const abeja = this.abejaDelPeek();
    const texto = this.textoDelPeek();
    this.expandido.set(false);
    if (!peek) return;

    const elementos = [peek, abeja, texto];
    gsap.killTweensOf(elementos);
    if (inmediato || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      gsap.set(peek, { width: 0, opacity: 0, scale: 1 });
      gsap.set(abeja, { opacity: 0, x: 0, y: 0, rotation: 0, scale: 1 });
      gsap.set(texto, { opacity: 1, x: 0 });
      return;
    }

    gsap
      .timeline()
      .to(texto, { x: 10, opacity: 0, duration: 0.15, ease: 'power2.in' }, 0)
      .to(abeja, { x: -24, rotation: -30, opacity: 0, duration: 0.25, ease: 'power2.in' }, 0)
      .to(
        peek,
        { width: 0, opacity: 0, scale: 0.92, duration: 0.32, ease: 'power3.in' },
        0.05,
      );
  }

  private animarEntradaPanel(): void {
    const panel = this.host.nativeElement.querySelector<HTMLElement>('.chat-widget__panel');
    const header = this.host.nativeElement.querySelector<HTMLElement>('.chat-widget__header');
    const body = this.host.nativeElement.querySelector<HTMLElement>('.chat-widget__body');
    if (!panel || !header || !body) return;

    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      gsap.set([panel, header, body], { y: 0, scale: 1, rotation: 0 });
      this.botonCerrar()?.focus();
      return;
    }

    gsap
      .timeline()
      .fromTo(
        panel,
        { y: 28, scale: 0.92, rotation: 1.5, transformOrigin: 'bottom right' },
        { y: 0, scale: 1, rotation: 0, duration: 0.55, ease: 'back.out(1.5)' },
      )
      .fromTo(header, { y: -14 }, { y: 0, duration: 0.35, ease: 'power2.out' }, 0.15)
      .fromTo(body, { y: 18 }, { y: 0, duration: 0.4, ease: 'power2.out' }, 0.2);

    this.botonCerrar()?.focus();
  }

  private animarBurbuja(vars: gsap.TweenVars): void {
    const boton = this.burbuja();
    if (!boton || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    gsap.to(boton, vars);
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
    this.plegar();
    if (devolverFoco) this.burbuja()?.focus();
  }

  private burbuja(): HTMLButtonElement | null {
    return this.host.nativeElement.querySelector<HTMLButtonElement>('.chat-widget__burbuja');
  }

  private botonCerrar(): HTMLButtonElement | null {
    return this.host.nativeElement.querySelector<HTMLButtonElement>('.chat-widget__cerrar');
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (!this.widget.abierto()) return;
    if (this.host.nativeElement.contains(event.target as Node)) return;
    this.cerrar(false);
  }

  @HostListener('document:keydown', ['$event'])
  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.widget.abierto()) {
      this.cerrar();
    }
  }
}
