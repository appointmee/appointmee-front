import { DsButtonComponent } from '../../shared/ui/button/button.component';
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
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subject, forkJoin, of } from 'rxjs';
import { catchError, map, startWith, switchMap, tap } from 'rxjs/operators';

import { ServicioDTO } from '../../models/servicio';
import { SucursalDetalleDTO } from '../../models/sucursal';
import { servicioService } from '../../services/servicio-service';
import { sucursalService } from '../../services/sucursal-service';

type ResultadoServicios =
  | { readonly ok: true; readonly servicios: readonly ServicioDTO[] }
  | { readonly ok: false; readonly error: HttpErrorResponse };

const LARGO_DESCRIPCION_COLGADA = 160;

const FORMATO_PRECIO = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
});

@Component({
  selector: 'app-servicios',
  imports: [DsButtonComponent, RouterLink],
  templateUrl: './servicios.html',
  styleUrl: './servicios.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Servicios {
  private readonly route = inject(ActivatedRoute);
  private readonly servicioService = inject(servicioService);
  private readonly sucursalService = inject(sucursalService);
  private readonly destroyRef = inject(DestroyRef);

  /** Acepta /sucursal/:sucursalId/servicios y /servicios?sucursalId=… */
  private readonly sucursalIdParam =
    this.route.snapshot.paramMap.get('sucursalId') ??
    this.route.snapshot.queryParamMap.get('sucursalId');

  protected readonly sucursalId = this.parseId(this.sucursalIdParam);
  protected readonly sinContexto = this.sucursalId === null;

  protected readonly sucursal = signal<SucursalDetalleDTO | null>(null);
  protected readonly servicios = signal<readonly ServicioDTO[]>([]);
  protected readonly cargando = signal(this.sucursalId !== null);
  protected readonly error = signal<string | null>(null);
  protected readonly requiereLogin = signal(false);
  /** La cuenta está autenticada pero no puede reservar por su rol. */
  protected readonly requiereRolCliente = signal(false);
  protected readonly reintentando = signal(false);
  /** El navegador perdió la conexión: se avisa sin descartar lo ya cargado. */
  protected readonly sinConexion = signal(!this.hayConexion());

  /** Id del único servicio seleccionado en la pantalla. */
  protected readonly seleccionadoId = signal<number | null>(null);
  /** Descripciones que el usuario expandió para leerlas completas. */
  protected readonly descripcionesExpandidas = signal<ReadonlySet<number>>(new Set());

  protected readonly seleccionado = computed(
    () =>
      this.servicios().find((servicio) => servicio.id === this.seleccionadoId()) ??
      null,
  );

  /** El botón de empleado sólo se habilita cuando hay una tarjeta seleccionada. */
  protected readonly puedeContinuar = computed(() => this.seleccionado() !== null);

  /** Durante una recarga se evita cambiar la selección con datos desactualizados. */
  protected readonly seleccionDeshabilitada = computed(
    () => this.cargando() || this.reintentando(),
  );

  protected readonly resumenServicios = computed(() => {
    const total = this.servicios().length;
    return total === 1 ? 'Se cargó 1 servicio.' : `Se cargaron ${total} servicios.`;
  });

  protected readonly nombreSucursal = computed(
    () =>
      this.sucursal()?.nombre ??
      this.servicios()[0]?.nombreSucursal ??
      (this.sucursalId !== null ? `Sucursal #${this.sucursalId}` : ''),
  );

  protected readonly detalleUrl = computed<readonly (string | number)[]>(() =>
    this.sucursalId !== null ? ['/sucursal', this.sucursalId] : ['/'],
  );

  protected readonly placeholderImage = `data:image/svg+xml;utf8,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400"><rect width="640" height="400" fill="#0d1117"/><g fill="none" stroke="#98a2b3" stroke-width="3"><rect x="220" y="110" width="200" height="150" rx="16"/><circle cx="280" cy="160" r="20"/><path d="M220 230l55-50 40 34 35-28 70 60"/></g><text x="320" y="310" text-anchor="middle" fill="#98a2b3" font-size="18" font-family="sans-serif">Sin imagen</text></svg>',
  )}`;

  private readonly reintento = new Subject<void>();
  /** El último error visible se produjo por falta de conexión. */
  private readonly errorConexion = signal(false);
  private readonly mensajeSinConexion =
    'Revisá tu conexión a internet y volvé a intentar.';

  private readonly onOffline = (): void => {
    this.sinConexion.set(true);
    if (this.errorConexion()) {
      this.error.set(this.mensajeSinConexion);
    }
  };

  private readonly onOnline = (): void => {
    this.sinConexion.set(false);
    if (this.errorConexion()) {
      this.error.set(
        'La conexión volvió a estar disponible. Reintentá para cargar los servicios.',
      );
    }
  };

  constructor() {
    this.registrarEventosDeConexion();

    const idSucursal = this.sucursalId;
    if (idSucursal === null) {
      return;
    }

    this.reintento
      .pipe(
        startWith(undefined as void),
        tap(() => {
          // En un reintento se mantiene el error inline (y el nombre de la
          // sucursal) hasta tener una respuesta. El skeleton es sólo para la
          // primera carga, no para reintentos ni para refrescar una lista ya
          // visible.
          this.cargando.set(this.error() === null && this.servicios().length === 0);
          this.sinConexion.set(!this.hayConexion());
          this.requiereLogin.set(false);
          this.requiereRolCliente.set(false);
        }),
        switchMap(() =>
          forkJoin({
            // Si la sucursal ya se mostró, el reintento conserva su nombre y
            // solo vuelve a pedir el listado que falló.
            sucursal: this.sucursal()
              ? of(this.sucursal())
              : this.sucursalService.obtenerPorId(idSucursal, true).pipe(catchError(() => of(null))),
            servicios: this.servicioService.listarPorSucursal(idSucursal).pipe(
              map((servicios): ResultadoServicios => ({ ok: true, servicios })),
              catchError((error: HttpErrorResponse) =>
                of<ResultadoServicios>({ ok: false, error }),
              ),
            ),
          }),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ sucursal, servicios }) => {
        if (sucursal) {
          this.sucursal.set(sucursal);
        }

        if (servicios.ok) {
          this.error.set(null);
          this.errorConexion.set(false);
          this.sinConexion.set(false);

          const lista = servicios.servicios ?? [];
          this.servicios.set(lista);

          // Si la recarga ya no incluye el servicio elegido, se limpia la
          // selección para que el botón no quede habilitado con datos viejos.
          if (
            this.seleccionadoId() !== null &&
            !lista.some((servicio) => servicio.id === this.seleccionadoId())
          ) {
            this.seleccionadoId.set(null);
          }
        } else {
          this.servicios.set([]);
          this.seleccionadoId.set(null);
          this.aplicarError(servicios.error);
        }

        this.cargando.set(false);
        this.reintentando.set(false);
      });
  }

  protected reintentar(): void {
    if (this.reintentando()) {
      return;
    }
    this.reintentando.set(true);
    this.reintento.next();
  }

  protected seleccionar(servicio: ServicioDTO): void {
    if (this.seleccionDeshabilitada()) {
      return;
    }

    this.seleccionadoId.set(servicio.id);
  }

  protected estaSeleccionado(servicio: ServicioDTO): boolean {
    return this.seleccionadoId() === servicio.id;
  }

  protected descripcionLarga(servicio: ServicioDTO): boolean {
    return (servicio.descripcion?.trim().length ?? 0) > LARGO_DESCRIPCION_COLGADA;
  }

  protected estaDescripcionExpandida(idServicio: number): boolean {
    return this.descripcionesExpandidas().has(idServicio);
  }

  protected alternarDescripcion(idServicio: number): void {
    this.descripcionesExpandidas.update((actuales) => {
      const siguiente = new Set(actuales);
      if (siguiente.has(idServicio)) {
        siguiente.delete(idServicio);
      } else {
        siguiente.add(idServicio);
      }
      return siguiente;
    });
  }

  protected foto(servicio: ServicioDTO): string {
    return servicio.fotoPerfil?.trim() || this.placeholderImage;
  }

  protected onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.onerror = null;
    img.src = this.placeholderImage;
  }

  protected formatDuracion(minutos: number | null | undefined): string {
    if (minutos === null || minutos === undefined || !Number.isFinite(minutos) || minutos <= 0) {
      return 'Duración a confirmar';
    }

    if (minutos < 60) {
      return `${minutos} min`;
    }

    const horas = Math.floor(minutos / 60);
    const resto = minutos % 60;
    return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`;
  }

  protected formatPrecio(precio: ServicioDTO['precio']): string {
    if (typeof precio === 'string' && !precio.trim()) {
      return 'Precio a consultar';
    }

    const valor = typeof precio === 'string' ? Number(precio) : precio;
    if (valor === null || valor === undefined || !Number.isFinite(valor)) {
      return 'Precio a consultar';
    }

    return FORMATO_PRECIO.format(valor);
  }

  protected trackById(_index: number, servicio: ServicioDTO): number {
    return servicio.id;
  }

  private aplicarError(error: HttpErrorResponse): void {
    this.errorConexion.set(false);

    if (error.status === 401) {
      this.error.set('Necesitás iniciar sesión para ver los servicios de esta sucursal.');
      this.requiereLogin.set(true);
      return;
    }

    if (error.status === 403) {
      this.error.set(
        'Tu cuenta no tiene el rol Cliente, necesario para reservar. Ingresá con una cuenta de cliente para continuar.',
      );
      this.requiereRolCliente.set(true);
      return;
    }

    if (error.status === 404) {
      this.error.set('No encontramos la sucursal solicitada.');
      return;
    }

    if (error.status === 0) {
      this.errorConexion.set(true);
      if (!this.hayConexion()) {
        this.sinConexion.set(true);
        this.error.set(this.mensajeSinConexion);
      } else {
        this.sinConexion.set(false);
        this.error.set(
          'No pudimos conectar con el servidor. Revisá tu conexión e intentá de nuevo.',
        );
      }
      return;
    }

    this.error.set(`No pudimos cargar los servicios de ${this.nombreSucursal()}.`);
  }

  private registrarEventosDeConexion(): void {
    if (typeof window === 'undefined') {
      return;
    }

    window.addEventListener('offline', this.onOffline);
    window.addEventListener('online', this.onOnline);
    this.destroyRef.onDestroy(() => {
      window.removeEventListener('offline', this.onOffline);
      window.removeEventListener('online', this.onOnline);
    });
  }

  private hayConexion(): boolean {
    return typeof navigator === 'undefined' || navigator.onLine;
  }

  private parseId(value: string | null): number | null {
    if (!value?.trim()) {
      return null;
    }

    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
  }
}
