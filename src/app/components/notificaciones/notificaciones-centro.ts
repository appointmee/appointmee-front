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
import { NavigationEnd, Router } from '@angular/router';
import { Subject, catchError, filter, map, of, switchMap } from 'rxjs';

import type {
  NotificacionDTO,
  PaginaNotificacionesDTO,
  TipoNotificacion,
} from '../../models/notificacion';
import { authService } from '../../services/auth-service';
import { chatWidgetService } from '../../services/chat-widget-service';
import { notificacionService } from '../../services/notificacion-service';
import { DsButtonComponent } from '../../shared/ui/button/button.component';
import {
  DsBadgeComponent,
  DsEmptyStateComponent,
  DsSkeletonComponent,
} from '../../shared/ui/misc/misc.component';

/** A dónde lleva cada notificación al abrirla. */
type DestinoNotificacion =
  | {
      readonly tipo: 'ruta';
      readonly ruta: string;
      readonly queryParams?: Readonly<Record<string, number>>;
    }
  | { readonly tipo: 'chat'; readonly conversacionId: number | null };

interface NotificacionVista extends NotificacionDTO {
  readonly destino: DestinoNotificacion;
}

const ICONOS = {
  campana: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21a2 2 0 0 0 4 0',
  cerrar: 'M18 6 6 18M6 6l12 12',
  turno: 'M7 2v4M17 2v4M3 9h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z',
  pago: 'M3 7h18v12H3zM3 11h18M7 15h4',
  solicitud: 'M4 4h16v16H4zM8 9h8M8 13h8M8 17h4',
  mensaje: 'M21 12a8 8 0 0 1-8 8H7l-4 3V12a8 8 0 0 1 16 0Z',
  sistema: 'M12 8v5M12 17h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  alerta: 'M12 8v5M12 17h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
};

const ETIQUETAS_TIPO: Record<TipoNotificacion, string> = {
  RESERVA: 'Turno',
  CANCELACION: 'Turno cancelado',
  RECORDATORIO: 'Recordatorio de turno',
  PAGO: 'Pago',
  SISTEMA: 'Novedad de la cuenta',
  SOLICITUD: 'Solicitud',
  MENSAJE: 'Mensaje',
};

const ICONOS_TIPO: Record<TipoNotificacion, string> = {
  RESERVA: ICONOS.turno,
  CANCELACION: ICONOS.turno,
  RECORDATORIO: ICONOS.turno,
  PAGO: ICONOS.pago,
  SISTEMA: ICONOS.sistema,
  SOLICITUD: ICONOS.solicitud,
  MENSAJE: ICONOS.mensaje,
};

@Component({
  selector: 'app-notificaciones-centro',
  imports: [DsButtonComponent, DsBadgeComponent, DsEmptyStateComponent, DsSkeletonComponent],
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

  /** El contador inicial llega del endpoint de no leídas; el listado trae su propio contador. */
  private readonly recargas = new Subject<boolean>();
  private cargado = false;
  private panelEnfocado = false;
  /** Persistencia en backend: SCRUM-329. Hasta entonces el estado se mantiene en la vista. */
  private readonly leidasEnSesion = signal<ReadonlySet<number>>(new Set<number>());

  private readonly formateadorFecha = new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

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
          return this.notificacionesService.listar().pipe(
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

  protected abrir(notificacion: NotificacionVista): void {
    if (!notificacion.leida) {
      const leidas = new Set(this.leidasEnSesion());
      leidas.add(notificacion.id);
      this.leidasEnSesion.set(leidas);
      this.notificaciones.update((lista) =>
        lista.map((item) =>
          item.id === notificacion.id ? { ...item, leida: true } : item,
        ),
      );
      this.noLeidas.update((cantidad) => Math.max(0, cantidad - 1));
    }

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
    return ETIQUETAS_TIPO[tipo] ?? 'Notificación';
  }

  protected iconoTipo(tipo: TipoNotificacion): string {
    return ICONOS_TIPO[tipo] ?? ICONOS.sistema;
  }

  protected fechaDe(fecha: string | null): string {
    if (!fecha) return 'Fecha no disponible';
    const fechaParseada = new Date(fecha);
    if (Number.isNaN(fechaParseada.getTime())) return 'Fecha no disponible';
    return this.formateadorFecha.format(fechaParseada);
  }

  protected ariaNotificacion(notificacion: NotificacionVista): string {
    const estado = notificacion.leida ? 'leída' : 'sin leer';
    return `${notificacion.titulo}. ${notificacion.mensaje}. ${estado}. ${this.fechaDe(notificacion.fecha)}. Abrir notificación.`;
  }

  private aVista(notificacion: NotificacionDTO): NotificacionVista {
    return {
      ...notificacion,
      leida: notificacion.leida || this.leidasEnSesion().has(notificacion.id),
      destino: this.destinoDe(notificacion),
    };
  }

  /** Usa el ID del backend cuando viene; si falta, mantiene la ruta genérica por tipo. */
  private destinoDe(notificacion: NotificacionDTO): DestinoNotificacion {
    const id = notificacion.destinoId ?? null;
    const sucursalId = notificacion.sucursalId ?? null;
    const parametros = (clave: string): Record<string, number> => {
      const valores: Record<string, number> = { [clave]: id as number };
      if (sucursalId !== null) valores['sucursalId'] = sucursalId;
      return valores;
    };

    if (id !== null && notificacion.destinoTipo) {
      switch (notificacion.destinoTipo) {
        case 'TURNO':
          return {
            tipo: 'ruta',
            ruta: this.rutaTurnos(),
            queryParams: parametros('turnoId'),
          };
        case 'PAGO':
          return {
            tipo: 'ruta',
            ruta: '/pago/resultado',
            queryParams: parametros('turnoId'),
          };
        case 'SOLICITUD':
          return { tipo: 'ruta', ruta: '/solicitudes', queryParams: { solicitudId: id } };
        case 'CONVERSACION':
          return { tipo: 'chat', conversacionId: id };
      }
    }

    switch (notificacion.tipo) {
      case 'PAGO':
        return { tipo: 'ruta', ruta: '/pago/resultado' };
      case 'SOLICITUD':
        return { tipo: 'ruta', ruta: '/solicitudes' };
      case 'MENSAJE':
        return { tipo: 'chat', conversacionId: null };
      case 'RESERVA':
      case 'CANCELACION':
      case 'RECORDATORIO':
        return { tipo: 'ruta', ruta: this.rutaTurnos() };
      default:
        return { tipo: 'ruta', ruta: '/configuracion' };
    }
  }
}
