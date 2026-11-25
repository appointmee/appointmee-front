import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnDestroy,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import {
  Subject,
  catchError,
  finalize,
  forkJoin,
  of,
  skip,
  takeUntil,
} from 'rxjs';

import type {
  ConversacionDetalleChat,
  ConversacionResumenChat,
  EstadoEntregaChat,
  MensajeChat,
} from '../../models/chat';
import { chatService } from '../../services/chat-service';
import {
  fusionarMensajes,
  chatRealtimeService,
} from '../../services/chat-realtime-service';
import { DsButtonComponent } from '../../shared/ui/button/button.component';

const LIMITE_MENSAJE = 2000;

const ETIQUETAS_ESTADO: Readonly<Record<EstadoEntregaChat, string>> = {
  ENVIADO: 'Enviado',
  ENTREGADO: 'Entregado',
  LEIDO: 'Leído',
};

/** Vista de conversaciones: listado, hilo y envío en tiempo real. */
@Component({
  selector: 'app-chat',
  imports: [DsButtonComponent],
  templateUrl: './chat.html',
  styleUrl: './chat.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Chat implements OnDestroy {
  private readonly chatApi = inject(chatService);
  private readonly realtime = inject(chatRealtimeService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly cambioHilo = new Subject<void>();

  private readonly fechaCorta = new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'short',
  });
  private readonly fechaCompleta = new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  protected readonly limiteMensaje = LIMITE_MENSAJE;
  protected readonly conversaciones = signal<ConversacionResumenChat[]>([]);
  protected readonly cargandoLista = signal(false);
  protected readonly errorLista = signal<string | null>(null);

  protected readonly seleccionada = signal<ConversacionResumenChat | null>(null);
  protected readonly detalle = signal<ConversacionDetalleChat | null>(null);
  protected readonly detalleCargando = signal(false);
  protected readonly errorDetalle = signal<string | null>(null);
  protected readonly errorHistorial = signal<string | null>(null);
  protected readonly mensajes = signal<MensajeChat[]>([]);
  protected readonly conectado = this.realtime.conectado;

  protected readonly texto = signal('');
  protected readonly intentado = signal(false);
  protected readonly enviando = signal(false);
  protected readonly errorEnvio = signal<string | null>(null);
  private readonly pendiente = signal<{ contenido: string; total: number } | null>(null);

  protected readonly errorValidacion = computed(() => {
    if (!this.intentado()) return null;
    const contenido = this.texto().trim();
    if (!contenido) return 'Escribí un mensaje antes de enviarlo.';
    if (contenido.length > LIMITE_MENSAJE) {
      return `El mensaje no puede superar los ${LIMITE_MENSAJE} caracteres.`;
    }
    return null;
  });

  protected readonly puedeEnviar = computed(
    () => !this.enviando() && !this.detalleCargando() && !this.errorHistorial(),
  );

  /** El backend calcula el interlocutor según el rol del usuario actual. */
  protected readonly etiquetaRol = computed(() =>
    this.seleccionada()?.rol === 'CLIENTE' ? 'Cliente' : 'Empleado',
  );

  /** Identificador del usuario actual dentro de la conversación, según su rol. */
  protected readonly idPropio = computed(() => {
    const conversacion = this.seleccionada();
    const detalle = this.detalle();
    if (!conversacion || !detalle) return null;
    return detalle.participantes.find((p) => p.rol === conversacion.rol)?.usuarioId ?? null;
  });

  constructor() {
    toObservable(this.realtime.mensajes)
      .pipe(skip(1), takeUntilDestroyed(this.destroyRef))
      .subscribe((entrantes) => this.incorporarMensajes(entrantes));

    toObservable(this.realtime.conectado)
      .pipe(skip(1), takeUntilDestroyed(this.destroyRef))
      .subscribe((conectado) => {
        if (!conectado && this.pendiente()) {
          this.pendiente.set(null);
          this.enviando.set(false);
          this.errorEnvio.set('Se perdió la conexión. Volvé a enviar el mensaje.');
        }
      });
  }

  ngOnInit(): void {
    this.cargarConversaciones();
  }

  ngOnDestroy(): void {
    this.realtime.desconectar();
  }

  cargarConversaciones(): void {
    if (this.cargandoLista()) return;
    this.cargandoLista.set(true);
    this.errorLista.set(null);

    this.chatApi
      .listar()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.cargandoLista.set(false)),
      )
      .subscribe({
        next: (lista) => this.conversaciones.set(lista),
        error: (error: unknown) =>
          this.errorLista.set(
            this.mensajeError(error, 'No pudimos cargar tus conversaciones.'),
          ),
      });
  }

  abrirConversacion(conversacion: ConversacionResumenChat): void {
    if (this.detalleCargando() || this.seleccionada()?.id === conversacion.id) return;

    this.cambioHilo.next();
    this.pendiente.set(null);
    this.enviando.set(false);
    this.errorEnvio.set(null);
    this.realtime.desconectar();

    this.mensajes.set([]);
    this.detalle.set(null);
    this.seleccionada.set(conversacion);
    this.errorDetalle.set(null);
    this.errorHistorial.set(null);
    this.texto.set('');
    this.intentado.set(false);
    this.detalleCargando.set(true);

    forkJoin({
      detalle: this.chatApi
        .obtener(conversacion.id)
        .pipe(catchError((error: unknown) => of({ error }))),
      historial: this.chatApi
        .listarMensajes(conversacion.id)
        .pipe(catchError((error: unknown) => of({ error }))),
    })
      .pipe(takeUntil(this.cambioHilo), takeUntilDestroyed(this.destroyRef))
      .subscribe(({ detalle, historial }) => {
        this.detalleCargando.set(false);

        if ('error' in detalle) {
          this.errorDetalle.set(
            this.mensajeError(detalle.error, 'No pudimos cargar el detalle de la conversación.'),
          );
        } else {
          this.detalle.set(detalle);
        }

        if ('error' in historial) {
          this.errorHistorial.set(
            this.mensajeError(historial.error, 'No pudimos cargar el historial de mensajes.'),
          );
          return;
        }

        this.mensajes.set(historial);
        const desdeId = historial.at(-1)?.id ?? 0;
        this.realtime.conectar(conversacion.id, desdeId);
        this.marcarLeido(conversacion);
      });
  }

  reintentarHistorial(): void {
    const conversacion = this.seleccionada();
    if (!conversacion || this.detalleCargando()) return;

    this.errorHistorial.set(null);
    this.detalleCargando.set(true);
    this.chatApi
      .listarMensajes(conversacion.id)
      .pipe(
        takeUntil(this.cambioHilo),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.detalleCargando.set(false)),
      )
      .subscribe({
        next: (mensajes) => {
          this.mensajes.set(mensajes);
          this.realtime.conectar(conversacion.id, mensajes.at(-1)?.id ?? 0);
        },
        error: (error: unknown) =>
          this.errorHistorial.set(
            this.mensajeError(error, 'No pudimos cargar el historial de mensajes.'),
          ),
      });
  }

  cerrarConversacion(): void {
    this.cambioHilo.next();
    this.pendiente.set(null);
    this.enviando.set(false);
    this.realtime.desconectar();
    this.mensajes.set([]);
    this.detalle.set(null);
    this.seleccionada.set(null);
    this.errorEnvio.set(null);
  }

  enviarMensaje(event?: Event): void {
    event?.preventDefault();
    this.intentado.set(true);

    const contenido = this.texto().trim();
    if (this.errorValidacion()) {
      this.enfocarTexto();
      return;
    }

    // Un segundo envío antes del eco del primero se descarta: evita duplicados.
    if (this.enviando()) return;

    if (!navigator.onLine) {
      this.errorEnvio.set('Sin conexión. Revisá tu red y volvé a intentar.');
      return;
    }
    if (!this.conectado()) {
      this.errorEnvio.set('Todavía no estamos conectados. Esperá un momento e intentá de nuevo.');
      return;
    }

    const total = this.mensajes().length;
    if (!this.realtime.enviar(contenido)) {
      this.errorEnvio.set('No se pudo enviar el mensaje. Intentá de nuevo.');
      return;
    }

    this.errorEnvio.set(null);
    this.texto.set('');
    this.intentado.set(false);
    this.pendiente.set({ contenido, total });
    this.enviando.set(true);
  }

  esPropio(mensaje: MensajeChat): boolean {
    const id = this.idPropio();
    return id !== null && mensaje.autorId === id;
  }

  etiquetaEstado(estado: EstadoEntregaChat): string {
    return ETIQUETAS_ESTADO[estado];
  }

  formatearFechaCorta(iso: string | null): string {
    return iso ? this.fechaCorta.format(new Date(iso)) : '—';
  }

  formatearFechaHora(iso: string | null): string {
    return iso ? this.fechaCompleta.format(new Date(iso)) : '—';
  }

  iniciales(nombre: string): string {
    return (
      nombre
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((parte) => parte.charAt(0).toUpperCase())
        .join('') || '?'
    );
  }

  ariaLabelConversacion(conversacion: ConversacionResumenChat): string {
    const noLeidos =
      conversacion.noLeidos > 0
        ? `${conversacion.noLeidos} mensajes no leídos.`
        : 'Sin mensajes no leídos.';
    return `${conversacion.interlocutor}, ${conversacion.sucursalNombre}. ${noLeidos} ${conversacion.ultimoMensaje ?? 'Sin mensajes'}`;
  }

  private marcarLeido(conversacion: ConversacionResumenChat): void {
    this.chatApi
      .marcarLeido(conversacion.id)
      .pipe(takeUntil(this.cambioHilo), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () =>
          this.conversaciones.update((lista) =>
            lista.map((item) => (item.id === conversacion.id ? { ...item, noLeidos: 0 } : item)),
          ),
        // Marcar como leído es secundario: no debe romper la vista del hilo.
        error: () => undefined,
      });
  }

  private incorporarMensajes(entrantes: MensajeChat[]): void {
    const id = this.seleccionada()?.id;
    if (id === undefined) return;

    const deEstaConversacion = entrantes.filter((mensaje) => mensaje.conversacionId === id);
    if (!deEstaConversacion.length) return;

    const totalAnterior = this.mensajes().length;
    this.mensajes.set(fusionarMensajes(this.mensajes(), deEstaConversacion));

    const pendiente = this.pendiente();
    if (
      pendiente &&
      this.mensajes().length > pendiente.total &&
      this.mensajes().some((mensaje) => mensaje.contenido === pendiente.contenido)
    ) {
      this.pendiente.set(null);
      this.enviando.set(false);
    }
  }

  private enfocarTexto(): void {
    this.host.nativeElement.querySelector('textarea')?.focus();
  }

  private mensajeError(error: unknown, fallback: string): string {
    if (!navigator.onLine) return 'Sin conexión. Revisá tu red e intentá de nuevo.';
    if (error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403)) {
      return 'No tenés permisos para ver estas conversaciones.';
    }
    return fallback;
  }
}
