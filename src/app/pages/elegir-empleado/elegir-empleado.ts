import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject, forkJoin, of } from 'rxjs';
import { catchError, map, startWith, switchMap, tap } from 'rxjs/operators';

import { EmpleadoDTO } from '../../models/empleado';
import { ServicioDTO } from '../../models/servicio';
import { SucursalDetalleDTO } from '../../models/sucursal';
import { DsButtonComponent } from '../../shared/ui/button/button.component';
import { empleadoService } from '../../services/empleado-service';
import { servicioService } from '../../services/servicio-service';
import { sucursalService } from '../../services/sucursal-service';

type ResultadoEmpleados =
  | { readonly ok: true; readonly empleados: readonly EmpleadoDTO[] }
  | { readonly ok: false; readonly error: HttpErrorResponse };

type ResultadoServicios =
  | { readonly ok: true; readonly servicios: readonly ServicioDTO[] }
  | { readonly ok: false; readonly error: HttpErrorResponse };

interface ResumenPuntuacion {
  readonly tienePuntuacion: boolean;
  readonly numero: string;
  readonly abejas: readonly number[];
}

const FORMATO_PUNTUACION = new Intl.NumberFormat('es-AR', {
  maximumFractionDigits: 1,
});

const MAXIMO_ABEJAS = 5;

/**
 * Segundo paso de la reserva: elegir el empleado de la sucursal que realizará
 * el servicio seleccionado. El endpoint devuelve únicamente empleados de la
 * sucursal pedida, por lo que el listado nunca mezcla sedes.
 */
@Component({
  selector: 'app-elegir-empleado',
  imports: [DsButtonComponent, RouterLink],
  templateUrl: './elegir-empleado.html',
  styleUrl: './elegir-empleado.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ElegirEmpleado {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly empleadoService = inject(empleadoService);
  private readonly servicioService = inject(servicioService);
  private readonly sucursalService = inject(sucursalService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly sucursalIdParam = this.route.snapshot.paramMap.get('sucursalId');
  private readonly servicioIdParam = this.route.snapshot.paramMap.get('servicioId');

  /** Empleado pedido por URL para conservar la selección al volver al paso. */
  private readonly empleadoIdUrl = this.parseId(
    this.route.snapshot.queryParamMap.get('empleadoId'),
  );

  protected readonly sucursalId = this.parseId(this.sucursalIdParam);
  protected readonly servicioId = this.parseId(this.servicioIdParam);
  protected readonly sinContexto = this.sucursalId === null || this.servicioId === null;

  protected readonly empleados = signal<readonly EmpleadoDTO[]>([]);
  protected readonly servicio = signal<ServicioDTO | null>(null);
  protected readonly sucursal = signal<SucursalDetalleDTO | null>(null);
  protected readonly cargando = signal(!this.sinContexto);
  protected readonly error = signal<string | null>(null);
  protected readonly reintentando = signal(false);
  /** Bloquea el botón mientras el router resuelve la navegación al paso 3. */
  protected readonly navegando = signal(false);
  protected readonly sinConexion = signal(!this.hayConexion());
  /** Aviso cuando el empleado pedido por URL ya no está disponible. */
  protected readonly avisoPreseleccion = signal<string | null>(null);

  /** Id del único empleado seleccionado en la pantalla. */
  protected readonly seleccionadoId = signal<number | null>(null);

  protected readonly seleccionado = computed(
    () =>
      this.empleados().find((empleado) => empleado.id === this.seleccionadoId()) ?? null,
  );

  protected readonly resumenSeleccion = computed(() => {
    const empleado = this.seleccionado();
    if (!empleado) {
      return null;
    }

    return {
      nombre: this.nombreCompleto(empleado),
      puntuacion: this.puntuacionTexto(empleado),
      tienePuntuacion: this.tienePuntuacion(empleado),
      abejas: this.abejas(empleado),
    };
  });

  /** El botón «Siguiente» sólo se habilita cuando hay una tarjeta seleccionada. */
  protected readonly puedeContinuar = computed(() => this.seleccionado() !== null);

  /** Durante una recarga o navegación se evita cambiar la selección. */
  protected readonly seleccionDeshabilitada = computed(
    () => this.cargando() || this.reintentando() || this.navegando(),
  );

  protected readonly resumenContexto = computed(() => {
    const sucursal = this.sucursal();
    const servicio = this.servicio();

    return {
      sucursal: {
        nombre:
          sucursal?.nombre?.trim() ||
          servicio?.nombreSucursal?.trim() ||
          (this.sucursalId !== null ? `Sucursal #${this.sucursalId}` : 'Sucursal'),
        ...this.construirPuntuacion(
          sucursal?.puntuacion,
          sucursal?.cantidadPuntuaciones,
        ),
      },
      servicio: {
        nombre:
          servicio?.nombre?.trim() ||
          (this.servicioId !== null ? `Servicio #${this.servicioId}` : 'Servicio'),
        ...this.construirPuntuacion(
          servicio?.puntuacion,
          servicio?.cantidadPuntuaciones,
        ),
      },
    };
  });

  protected readonly volverLink = computed<readonly (string | number)[]>(() =>
    this.sucursalId !== null ? ['/sucursal', this.sucursalId, 'servicios'] : ['/'],
  );

  protected readonly volverQueryParams = computed(() =>
    this.servicioId !== null ? { servicioId: this.servicioId } : {},
  );

  protected readonly placeholderAvatar = `data:image/svg+xml;utf8,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240"><rect width="240" height="240" fill="#10151d"/><circle cx="120" cy="92" r="38" fill="#39424f"/><path d="M48 216c9-47 36-72 72-72s63 25 72 72" fill="#39424f"/></svg>',
  )}`;

  private readonly reintento = new Subject<void>();
  /** El último error visible se produjo por falta de conexión. */
  private readonly errorConexion = signal(false);
  private readonly mensajeSinConexion = 'Revisá tu conexión a internet y volvé a intentar.';

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
        'La conexión volvió a estar disponible. Reintentá para cargar los empleados.',
      );
    }
  };

  constructor() {
    this.registrarEventosDeConexion();

    const idSucursal = this.sucursalId;
    const idServicio = this.servicioId;
    if (idSucursal === null || idServicio === null) {
      return;
    }

    this.reintento
      .pipe(
        startWith(undefined as void),
        tap(() => {
          this.cargando.set(
            this.error() === null && this.empleados().length === 0,
          );
          this.sinConexion.set(!this.hayConexion());
        }),
        switchMap(() =>
          forkJoin({
            sucursal: this.sucursal()
              ? of(this.sucursal())
              : this.sucursalService
                  .obtenerPorId(idSucursal, true)
                  .pipe(catchError(() => of(null))),
            servicios: this.servicioService.listarPorSucursal(idSucursal).pipe(
              map((servicios): ResultadoServicios => ({ ok: true, servicios })),
              catchError((error: HttpErrorResponse) =>
                of<ResultadoServicios>({ ok: false, error }),
              ),
            ),
            empleados: this.empleadoService.listarPorSucursal(idSucursal).pipe(
              map(
                (empleados): ResultadoEmpleados => ({
                  ok: true,
                  empleados: empleados ?? [],
                }),
              ),
              catchError((error: HttpErrorResponse) =>
                of<ResultadoEmpleados>({ ok: false, error }),
              ),
            ),
          }),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ sucursal, servicios, empleados }) => {
        if (sucursal) {
          this.sucursal.set(sucursal);
        }

        this.aplicarContexto(servicios, idServicio);

        if (empleados.ok) {
          this.error.set(null);
          this.errorConexion.set(false);
          this.sinConexion.set(false);

          const lista = empleados.empleados ?? [];
          this.empleados.set(lista);

          // Si la recarga ya no incluye el empleado elegido, se limpia la
          // selección para que el botón no quede habilitado con datos viejos.
          if (
            this.seleccionadoId() !== null &&
            !lista.some((empleado) => empleado.id === this.seleccionadoId())
          ) {
            this.seleccionadoId.set(null);
          }

          this.aplicarPreseleccionDesdeUrl(lista);
        } else {
          this.empleados.set([]);
          this.seleccionadoId.set(null);
          this.aplicarError(empleados.error);
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

  protected seleccionar(empleado: EmpleadoDTO): void {
    if (this.seleccionDeshabilitada()) {
      return;
    }

    this.seleccionadoId.set(empleado.id);
    this.avisoPreseleccion.set(null);
  }

  protected estaSeleccionado(empleado: EmpleadoDTO): boolean {
    return this.seleccionadoId() === empleado.id;
  }

  /**
   * Dentro de un radiogroup sólo una opción participa del tabulador: la
   * seleccionada o, si todavía no hay selección, la primera.
   */
  protected esOpcionEnfocable(empleado: EmpleadoDTO): boolean {
    const idSeleccionado = this.seleccionadoId();
    if (idSeleccionado !== null) {
      return idSeleccionado === empleado.id;
    }
    return this.empleados()[0]?.id === empleado.id;
  }

  /** Navegación con flechas y activación con Enter/Espacio del grupo radio. */
  protected onTeclaOpcion(event: KeyboardEvent, empleado: EmpleadoDTO): void {
    if (this.seleccionDeshabilitada()) {
      return;
    }

    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      this.seleccionar(empleado);
      this.enfocarEmpleado(empleado.id);
      return;
    }

    const navegacion = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'];
    if (!navegacion.includes(event.key)) {
      return;
    }

    const lista = this.empleados();
    const actual = lista.findIndex((item) => item.id === empleado.id);
    if (actual < 0 || lista.length === 0) {
      return;
    }

    event.preventDefault();
    let destino = actual;

    if (event.key === 'Home') {
      destino = 0;
    } else if (event.key === 'End') {
      destino = lista.length - 1;
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      destino = (actual + 1) % lista.length;
    } else {
      destino = (actual - 1 + lista.length) % lista.length;
    }

    const siguiente = lista[destino];
    this.seleccionar(siguiente);
    this.enfocarEmpleado(siguiente.id);
  }

  /** Continúa al paso 3 del flujo de reserva conservando sucursal, servicio y empleado. */
  protected continuar(): void {
    if (this.navegando()) {
      return;
    }

    const empleado = this.seleccionado();
    if (!empleado || this.sucursalId === null || this.servicioId === null) {
      return;
    }

    this.navegando.set(true);
    this.router
      .navigate(
        ['/sucursal', this.sucursalId, 'servicios', this.servicioId, 'turnos'],
        { queryParams: { empleadoId: empleado.id } },
      )
      .then((navego) => {
        if (!navego) {
          this.navegando.set(false);
        }
      })
      .catch(() => this.navegando.set(false));
  }

  protected nombre(empleado: EmpleadoDTO): string {
    return empleado.nombre?.trim() || 'Profesional';
  }

  protected apellido(empleado: EmpleadoDTO): string {
    return empleado.apellido?.trim() || '';
  }

  protected nombreCompleto(empleado: EmpleadoDTO): string {
    return [this.nombre(empleado), this.apellido(empleado)].filter(Boolean).join(' ');
  }

  protected foto(empleado: EmpleadoDTO): string {
    return empleado.urlFotoPerfil?.trim() || this.placeholderAvatar;
  }

  protected onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.onerror = null;
    img.src = this.placeholderAvatar;
  }

  protected tienePuntuacion(empleado: EmpleadoDTO): boolean {
    const cantidad = empleado.cantidadPuntuaciones;
    return (
      typeof cantidad === 'number' &&
      Number.isFinite(cantidad) &&
      cantidad > 0 &&
      typeof empleado.puntuacion === 'number' &&
      Number.isFinite(empleado.puntuacion)
    );
  }

  protected puntuacion(empleado: EmpleadoDTO): number {
    const valor = empleado.puntuacion;
    return typeof valor === 'number' && Number.isFinite(valor)
      ? Math.max(0, Math.min(MAXIMO_ABEJAS, Math.round(valor)))
      : 0;
  }

  protected puntuacionTexto(empleado: EmpleadoDTO): string {
    if (!this.tienePuntuacion(empleado)) {
      return '';
    }

    const puntuacion = empleado.puntuacion;
    return typeof puntuacion === 'number'
      ? `${FORMATO_PUNTUACION.format(puntuacion)}/${MAXIMO_ABEJAS}`
      : '';
  }

  protected abejas(empleado: EmpleadoDTO): readonly number[] {
    if (!this.tienePuntuacion(empleado)) {
      return [];
    }

    return Array.from({ length: this.puntuacion(empleado) });
  }

  protected trackById(_index: number, empleado: EmpleadoDTO): number {
    return empleado.id;
  }

  /**
   * Conserva la selección pedida por URL cuando el empleado existe. Si ya no
   * está disponible, no deja una selección inválida ni elige a otra persona.
   */
  private aplicarPreseleccionDesdeUrl(lista: readonly EmpleadoDTO[]): void {
    const idUrl = this.empleadoIdUrl;
    if (idUrl === null) {
      return;
    }

    if (lista.some((empleado) => empleado.id === idUrl)) {
      const actual = this.seleccionadoId();
      const actualValido =
        actual !== null && lista.some((empleado) => empleado.id === actual);

      if (!actualValido || actual === idUrl) {
        this.seleccionadoId.set(idUrl);
      }
      this.avisoPreseleccion.set(null);
      return;
    }

    const actual = this.seleccionadoId();
    const conservarSeleccion =
      actual !== null && lista.some((empleado) => empleado.id === actual);

    if (!conservarSeleccion) {
      this.seleccionadoId.set(null);
    }
    this.avisoPreseleccion.set(
      'El profesional que intentaste preseleccionar ya no está disponible. Elegí otro profesional para continuar.',
    );
  }

  /**
   * Normaliza la puntuación y las abejas de sucursal y servicio. Si todavía no
   * hay reseñas no se inventa una puntuación: se informa explícitamente.
   */
  private construirPuntuacion(
    puntuacion: number | null | undefined,
    cantidadPuntuaciones: number | null | undefined,
  ): ResumenPuntuacion {
    if (
      typeof puntuacion !== 'number' ||
      !Number.isFinite(puntuacion) ||
      typeof cantidadPuntuaciones !== 'number' ||
      !Number.isFinite(cantidadPuntuaciones) ||
      cantidadPuntuaciones <= 0
    ) {
      return { tienePuntuacion: false, numero: '', abejas: [] };
    }

    const abejas = Math.max(
      0,
      Math.min(MAXIMO_ABEJAS, Math.round(puntuacion)),
    );

    return {
      tienePuntuacion: true,
      numero: `${FORMATO_PUNTUACION.format(puntuacion)}/${MAXIMO_ABEJAS}`,
      abejas: Array.from({ length: abejas }),
    };
  }

  private aplicarContexto(
    resultado: ResultadoServicios,
    idServicio: number,
  ): void {
    if (!resultado.ok) {
      return;
    }

    this.servicio.set(
      resultado.servicios.find((servicio) => servicio.id === idServicio) ?? null,
    );
  }

  private enfocarEmpleado(idEmpleado: number): void {
    this.host.nativeElement
      .querySelector<HTMLButtonElement>(`[data-empleado-id="${idEmpleado}"]`)
      ?.focus();
  }

  private aplicarError(error: HttpErrorResponse): void {
    this.errorConexion.set(false);

    if (error.status === 401) {
      this.error.set(
        'Necesitás iniciar sesión para ver los profesionales de esta sucursal.',
      );
      return;
    }

    if (error.status === 403) {
      this.error.set(
        'Tu cuenta no tiene permiso para ver los profesionales de esta sucursal.',
      );
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

    this.error.set(
      `No pudimos cargar los profesionales de ${this.resumenContexto().sucursal.nombre}.`,
    );
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
