import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  afterRenderEffect,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { Subject, catchError, filter, map, of, switchMap } from 'rxjs';

import type {
  NotificacionDTO,
  PaginaNotificacionesDTO,
  TipoNotificacion,
} from '../../models/notificacion';
import { authService } from '../../services/auth-service';
import { chatWidgetService } from '../../services/chat-widget-service';
import { notificacionService } from '../../services/notificacion-service';
import {
  ariaNotificacion,
  destinoDeNotificacion,
  etiquetaTipoNotificacion,
  formatearFechaNotificacion,
  iconoTipoNotificacion,
  type DestinoNotificacion,
} from '../../shared/notificaciones/destino-notificacion';
import { DsButtonComponent } from '../../shared/ui/button/button.component';
import {
  DsBadgeComponent,
  DsEmptyStateComponent,
  DsSkeletonComponent,
} from '../../shared/ui/misc/misc.component';

/** El panel muestra sólo la primera página; la vista completa se abre con "Ver todas". */
const LIMITE_NOTIFICACIONES = 20;

interface NotificacionVista extends NotificacionDTO {
  readonly destino: DestinoNotificacion;
}

const ICONOS = {
  campana: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21a2 2 0 0 0 4 0',
  cerrar: 'M18 6 6 18M6 6l12 12',
  alerta: 'M12 8v5M12 17h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
};

@Component({
  selector: 'app-notificaciones-centro',
  imports: [
    DsButtonComponent,
    DsBadgeComponent,
    DsEmptyStateComponent,
    DsSkeletonComponent,
    RouterLink,
  ],
  templateUrl: './notificaciones-centro.html',
  styleUrl: './notificaciones-centro.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificacionesCentro {
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly auth = inject(authService);
  private readonly notificacionesService = inject(notificacionService);
  private readonly chatWidget = inject(chatWidgetService);

  private readonly campana = viewChild('campana', { read: ElementRef<HTMLButtonElement> });
  private readonly cerrarBoton = viewChild('cerrar', { read: ElementRef<HTMLButtonElement> });

  protected readonly iconos = ICONOS;
  protected readonly abierto = signal(false);
  protected readonly notificaciones = signal<readonly NotificacionVista[]>([]);
  protected readonly noLeidas = signal(0);
  protected readonly cargando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly reintentando = signal(false);
  protected readonly sinConexion = signal(typeof navigator !== 'undefined' && !navigator.onLine);
  protected readonly accionError = signal<string | null>(null);
  protected readonly idEnProceso = signal<number | null>(null);
  protected readonly marcandoTodas = signal(false);

  /** El contador inicial llega del endpoint de no leídas; el listado trae su propio contador. */
  private readonly recargas = new Subject<boolean>();
  private cargado = false;
  private panelEnfocado = false;
  private readonly ultimaAccion = signal<'una' | 'todas' | null>(null);
  private readonly ultimoId = signal<number | null>(null);

  /** Los turnos se consultan en el lugar que corresponde al rol del usuario. */
  private readonly rutaTurnos = computed(() => {
    if (this.auth.tieneAlgunRol('ADMINISTRADOR')) return '/admin';
    if (this.auth.tieneAlgunRol('EMPLEADO')) return '/turnos-asignados';
    return '/mis-turnos';
  });

  protected readonly ariaCampana = computed(() => {
    const cantidad = this.noLeidas();
    if (cantidad === 0) return 'Notificaciones, no hay notificaciones sin leer';
    return `Notificaciones, ${cantidad} sin leer`;
  });

  protected readonly resumen = computed(() => {
    if (this.cargando()) return '';
    if (this.error()) return '';
    const total = this.notificaciones().length;
    if (total === 0) return 'No tenés notificaciones.';
    return `Hay ${total} ${total === 1 ? 'notificación' : 'notificaciones'}; ${this.noLeidas()} sin leer.`;
  });

  protected readonly puedeMarcarTodas = computed(
    () =>
      this.noLeidas() > 0 &&
      !this.cargando() &&
      !this.reintentando() &&
      !this.marcandoTodas() &&
      this.idEnProceso() === null,
  );

  constructor() {
    afterRenderEffect(() => {
      if (!this.abierto()) {
        this.panelEnfocado = false;
        return;
      }
      if (this.panelEnfocado) return;
      this.panelEnfocado = true;
      const boton = this.cerrarBoton();
      if (boton?.nativeElement) boton.nativeElement.focus();
    });

    this.recargas
      .pipe(
        switchMap((esReintento) => {
          this.error.set(null);
          this.cargando.set(!esReintento);
          this.reintentando.set(esReintento);
          return this.notificacionesService
            .listar(0, LIMITE_NOTIFICACIONES)
            .pipe(
              map((pagina: PaginaNotificacionesDTO) => ({ ok: true as const, pagina })),
              catchError((error: HttpErrorResponse) =>
                of({ ok: false as const, error }),
              ),
            );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((resultado) => {
        this.cargando.set(false);
        this.reintentando.set(false);
        if (!resultado.ok) {
          this.error.set(
            this.sinConexion() || resultado.error.status === 0
              ? 'Sin conexión a internet. Revisá tu conexión y reintentá.'
              : 'No pudimos cargar tus notificaciones. Probá de nuevo.',
          );
          return;
        }

        this.cargado = true;
        this.noLeidas.set(resultado.pagina.noLeidas);
        this.notificaciones.set(
          resultado.pagina.contenido.map((notificacion) => this.aVista(notificacion)),
        );
      });

    if (this.auth.autenticado() && !this.auth.visitante() && !this.auth.restaurando()) {
      this.notificacionesService
        .contarNoLeidas()
        .pipe(
          catchError(() => of(null)),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe((contador) => {
          if (contador) {
            this.noLeidas.set(contador.noLeidas);
          }
        });
    }

    this.router.events
      .pipe(
        filter((evento) => evento instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.cerrarNotificaciones());
  }

  protected toggleNotificaciones(event: MouseEvent): void {
    event.stopPropagation();
    if (this.abierto()) {
      this.cerrarNotificaciones(true);
      return;
    }

    this.abierto.set(true);
    // afterRenderEffect lleva el foco al botón de cierre cuando el panel ya está en el DOM.
    if (!this.cargado) {
      this.recargar(false);
    }
  }

  protected reintentar(): void {
    this.recargar(true);
  }

  /** Guard contra dobles clics mientras hay una carga en curso. */
  private recargar(esReintento: boolean): void {
    if (this.cargando() || this.reintentando()) return;
    this.recargas.next(esReintento);
  }

  protected cerrarNotificaciones(devolverFoco: boolean = false): void {
    if (!this.abierto()) return;
    this.abierto.set(false);
    if (devolverFoco) {
      this.campana()?.nativeElement.focus();
    }
  }

  @HostListener('document:click')
  protected onDocumentClick(): void {
    this.cerrarNotificaciones();
  }

  @HostListener('document:keydown', ['$event'])
  protected onDocumentKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.abierto()) {
      this.cerrarNotificaciones(true);
    }
  }

  @HostListener('window:online')
  protected onOnline(): void {
    this.sinConexion.set(false);
  }

  @HostListener('window:offline')
  protected onOffline(): void {
    this.sinConexion.set(true);
  }

  /** Acción explícita de la demo 1: marcar una notificación como leída. */
  protected marcarLeida(notificacion: NotificacionVista): void {
    if (
      notificacion.leida ||
      this.idEnProceso() !== null ||
      this.marcandoTodas() ||
      this.cargando() ||
      this.reintentando()
    ) {
      return;
    }

    this.idEnProceso.set(notificacion.id);
    this.accionError.set(null);
    this.ultimaAccion.set('una');
    this.ultimoId.set(notificacion.id);

    this.notificacionesService
      .marcarLeida(notificacion.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (contador) => {
          this.noLeidas.set(contador.noLeidas);
          this.notificaciones.update((lista) =>
            lista.map((item) =>
              item.id === notificacion.id ? { ...item, leida: true } : item,
            ),
          );
          this.idEnProceso.set(null);
          this.recargar(true);
        },
        error: (error: HttpErrorResponse) => {
          this.idEnProceso.set(null);
          this.accionError.set(this.mensajeErrorAccion(error));
        },
      });
  }

  /** Acción explícita de la demo 2: marcar todas como leídas de una sola vez. */
  protected marcarTodas(): void {
    if (!this.puedeMarcarTodas()) return;

    this.marcandoTodas.set(true);
    this.accionError.set(null);
    this.ultimaAccion.set('todas');
    this.ultimoId.set(null);

    this.notificacionesService
      .marcarTodasLeidas()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (contador) => {
          this.noLeidas.set(contador.noLeidas);
          this.marcandoTodas.set(false);
          this.recargar(true);
        },
        error: (error: HttpErrorResponse) => {
          this.marcandoTodas.set(false);
          this.accionError.set(this.mensajeErrorAccion(error));
        },
      });
  }

  /** Reintento del error inline: vuelve a ejecutar la última acción con el mismo contexto. */
  protected reintentarAccion(): void {
    if (this.ultimaAccion() === 'todas') {
      this.marcarTodas();
      return;
    }
    const id = this.ultimoId();
    if (id === null) return;
    const notificacion = this.notificaciones().find((item) => item.id === id);
    if (notificacion) this.marcarLeida(notificacion);
  }

  private mensajeErrorAccion(error: HttpErrorResponse): string {
    const sufijo =
      this.ultimaAccion() === 'todas'
        ? 'No pudimos marcar todas las notificaciones como leídas.'
        : 'No pudimos marcar la notificación como leída.';
    if (this.sinConexion() || error.status === 0) {
      return `Sin conexión a internet. ${sufijo} Probá de nuevo cuando vuelva la conexión.`;
    }
    return `${sufijo} Probá de nuevo.`;
  }

  protected abrir(notificacion: NotificacionVista): void {
    this.cerrarNotificaciones();
    const destino = notificacion.destino;
    if (destino.tipo === 'chat') {
      if (destino.conversacionId !== null) {
        this.chatWidget.abrirConversacion(destino.conversacionId);
      } else {
        this.chatWidget.abrirConEnfoque();
      }
    } else {
      void this.router.navigate([destino.ruta], {
        queryParams: destino.queryParams ?? {},
      });
    }
  }

  protected etiquetaTipo(tipo: TipoNotificacion): string {
    return etiquetaTipoNotificacion(tipo);
  }

  protected iconoTipo(tipo: TipoNotificacion): string {
    return iconoTipoNotificacion(tipo);
  }

  protected fechaDe(fecha: string | null): string {
    return formatearFechaNotificacion(fecha);
  }

  protected ariaNotificacion(notificacion: NotificacionVista): string {
    return ariaNotificacion(notificacion);
  }

  private aVista(notificacion: NotificacionDTO): NotificacionVista {
    return {
      ...notificacion,
      destino: destinoDeNotificacion(notificacion, this.rutaTurnos()),
    };
  }
}
