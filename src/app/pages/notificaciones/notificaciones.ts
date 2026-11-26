import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { Subject, catchError, map, of, switchMap } from 'rxjs';

import type {
  NotificacionDTO,
  PaginaNotificacionesDTO,
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
  DsPaginationComponent,
  DsSkeletonComponent,
} from '../../shared/ui/misc/misc.component';

const TAMANO_PAGINA = 20;

interface NotificacionVista extends NotificacionDTO {
  readonly destino: DestinoNotificacion;
}

type ResultadoLista =
  | { readonly ok: true; readonly pagina: PaginaNotificacionesDTO }
  | { readonly ok: false; readonly error: HttpErrorResponse };

@Component({
  selector: 'app-notificaciones',
  imports: [
    DsButtonComponent,
    DsBadgeComponent,
    DsSkeletonComponent,
    DsEmptyStateComponent,
    DsPaginationComponent,
    RouterLink,
  ],
  templateUrl: './notificaciones.html',
  styleUrl: './notificaciones.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Notificaciones {
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly auth = inject(authService);
  private readonly servicio = inject(notificacionService);
  private readonly chatWidget = inject(chatWidgetService);

  private readonly recargas = new Subject<number>();
  /** Persistencia en backend: SCRUM-329. Hasta entonces el estado se mantiene en la vista. */
  private readonly leidasEnSesion = signal<ReadonlySet<number>>(new Set<number>());

  protected readonly notificaciones = signal<readonly NotificacionVista[]>([]);
  protected readonly pagina = signal(1);
  protected readonly totalPaginas = signal(1);
  protected readonly noLeidas = signal(0);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly reintentando = signal(false);
  protected readonly sinConexion = signal(typeof navigator !== 'undefined' && !navigator.onLine);

  protected readonly resumen = computed(() => {
    if (this.cargando()) return '';
    if (this.error()) return '';
    const total = this.notificaciones().length;
    if (total === 0) return 'No tenés notificaciones.';
    return `Página ${this.pagina()} de ${this.totalPaginas()}; ${this.noLeidas()} sin leer.`;
  });

  private readonly rutaTurnos = computed(() => {
    if (this.auth.tieneAlgunRol('ADMINISTRADOR')) return '/admin';
    if (this.auth.tieneAlgunRol('EMPLEADO')) return '/turnos-asignados';
    return '/mis-turnos';
  });

  constructor() {
    this.recargas
      .pipe(
        switchMap((pagina) => {
          this.error.set(null);
          this.cargando.set(this.notificaciones().length === 0);
          this.reintentando.set(this.notificaciones().length > 0);
          return this.servicio.listar(pagina - 1, TAMANO_PAGINA).pipe(
            map((respuesta): ResultadoLista => ({ ok: true, pagina: respuesta })),
            catchError((error: HttpErrorResponse) => of<ResultadoLista>({ ok: false, error })),
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

        this.noLeidas.set(resultado.pagina.noLeidas);
        this.totalPaginas.set(Math.max(1, resultado.pagina.totalPaginas));
        this.notificaciones.set(
          resultado.pagina.contenido.map((notificacion) => this.aVista(notificacion)),
        );
      });

    this.recargas.next(1);
  }

  protected cambiarPagina(pagina: number): void {
    if (pagina === this.pagina() || this.cargando() || this.reintentando()) return;
    this.pagina.set(pagina);
    this.recargas.next(pagina);
  }

  protected reintentar(): void {
    if (this.cargando() || this.reintentando()) return;
    this.recargas.next(this.pagina());
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

  protected etiquetaTipo = etiquetaTipoNotificacion;
  protected iconoTipo = iconoTipoNotificacion;
  protected fechaDe = formatearFechaNotificacion;
  protected ariaNotificacion = ariaNotificacion;

  private aVista(notificacion: NotificacionDTO): NotificacionVista {
    return {
      ...notificacion,
      leida: notificacion.leida || this.leidasEnSesion().has(notificacion.id),
      destino: destinoDeNotificacion(notificacion, this.rutaTurnos()),
    };
  }
}
