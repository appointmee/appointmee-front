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
  FiltroLecturaNotificacion,
  FiltroTipoNotificacion,
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
  TIPOS_NOTIFICACION,
  type DestinoNotificacion,
} from '../../shared/notificaciones/destino-notificacion';
import { DsButtonComponent } from '../../shared/ui/button/button.component';
import {
  DsEmptyStateComponent,
  DsPaginationComponent,
  DsSkeletonComponent,
} from '../../shared/ui/misc/misc.component';

const TAMANO_PAGINA = 20;

const LECTURAS: readonly FiltroLecturaNotificacion[] = ['TODAS', 'NO_LEIDAS', 'LEIDAS'];

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
  private readonly ultimaAccion = signal<'una' | 'todas' | null>(null);
  private readonly ultimoId = signal<number | null>(null);

  protected readonly tipos = TIPOS_NOTIFICACION;
  protected readonly lecturas = LECTURAS;
  protected readonly notificaciones = signal<readonly NotificacionVista[]>([]);
  protected readonly pagina = signal(1);
  protected readonly totalPaginas = signal(1);
  protected readonly noLeidas = signal(0);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly reintentando = signal(false);
  protected readonly sinConexion = signal(typeof navigator !== 'undefined' && !navigator.onLine);
  protected readonly filtroTipo = signal<FiltroTipoNotificacion>('TODOS');
  protected readonly filtroLectura = signal<FiltroLecturaNotificacion>('TODAS');
  protected readonly accionError = signal<string | null>(null);
  protected readonly idEnProceso = signal<number | null>(null);
  protected readonly marcandoTodas = signal(false);

  protected readonly resumen = computed(() => {
    if (this.cargando()) return '';
    if (this.error()) return '';
    const total = this.notificaciones().length;
    if (total === 0) return 'No tenés notificaciones.';
    return `Página ${this.pagina()} de ${this.totalPaginas()}; ${this.noLeidas()} sin leer.`;
  });

  protected readonly hayFiltros = computed(
    () => this.filtroTipo() !== 'TODOS' || this.filtroLectura() !== 'TODAS',
  );

  protected readonly puedeMarcarTodas = computed(
    () =>
      this.noLeidas() > 0 &&
      !this.cargando() &&
      !this.reintentando() &&
      !this.marcandoTodas() &&
      this.idEnProceso() === null,
  );

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
          return this.servicio
            .listar(pagina - 1, TAMANO_PAGINA, this.filtroTipo(), this.filtroLectura())
            .pipe(
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

  protected cambiarFiltroTipo(event: Event): void {
    const valor = (event.target as HTMLSelectElement).value as FiltroTipoNotificacion;
    if (valor === this.filtroTipo()) return;
    if (valor !== 'TODOS' && !TIPOS_NOTIFICACION.includes(valor)) return;
    this.filtroTipo.set(valor);
    this.pagina.set(1);
    this.recargas.next(1);
  }

  protected cambiarFiltroLectura(event: Event): void {
    const valor = (event.target as HTMLSelectElement).value as FiltroLecturaNotificacion;
    if (!LECTURAS.includes(valor) || valor === this.filtroLectura()) return;
    this.filtroLectura.set(valor);
    this.pagina.set(1);
    this.recargas.next(1);
  }

  protected limpiarFiltros(): void {
    if (!this.hayFiltros()) return;
    this.filtroTipo.set('TODOS');
    this.filtroLectura.set('TODAS');
    this.pagina.set(1);
    this.recargas.next(1);
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

    this.servicio
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
          this.recargas.next(this.pagina());
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

    this.servicio
      .marcarTodasLeidas(this.filtroTipo())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (contador) => {
          this.noLeidas.set(contador.noLeidas);
          this.marcandoTodas.set(false);
          this.recargas.next(this.pagina());
        },
        error: (error: HttpErrorResponse) => {
          this.marcandoTodas.set(false);
          this.accionError.set(this.mensajeErrorAccion(error));
        },
      });
  }

  /** Reintento del error inline con el mismo filtro y la misma acción. */
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
    // Entrar a la notificación también la marca como leída, sin bloquear la navegación.
    if (!notificacion.leida) this.marcarLeida(notificacion);
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
      destino: destinoDeNotificacion(notificacion, this.rutaTurnos()),
    };
  }
}
