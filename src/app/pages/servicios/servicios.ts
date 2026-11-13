import { DsButtonComponent } from '../../shared/ui/button/button.component';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  afterEveryRender,
  computed,
  inject,
  signal,
  viewChildren,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject, forkJoin, of } from 'rxjs';
import { catchError, map, startWith, switchMap, tap } from 'rxjs/operators';

import { ServicioDTO } from '../../models/servicio';
import { SucursalDetalleDTO } from '../../models/sucursal';
import { reservaContextoService } from '../../services/reserva-contexto-service';
import { servicioService } from '../../services/servicio-service';
import { sucursalService } from '../../services/sucursal-service';

type ResultadoServicios =
  | { readonly ok: true; readonly servicios: readonly ServicioDTO[] }
  | { readonly ok: false; readonly error: HttpErrorResponse };

/**
 * Sólo se usa cuando el navegador no expone medidas de layout (por ejemplo,
 * jsdom en los tests). En un navegador real manda la medición del desborde.
 */
const LARGO_DESCRIPCION_ESTIMADO = 160;

const FORMATO_PRECIO = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
});

const FORMATO_PUNTUACION = new Intl.NumberFormat('es-AR', {
  maximumFractionDigits: 1,
});

const MAXIMO_ABEJAS = 5;

@Component({
  selector: 'app-servicios',
  imports: [DsButtonComponent, RouterLink],
  templateUrl: './servicios.html',
  styleUrl: './servicios.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Servicios {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly servicioService = inject(servicioService);
  private readonly sucursalService = inject(sucursalService);
  private readonly reservaContexto = inject(reservaContextoService);
  private readonly destroyRef = inject(DestroyRef);

  /** Acepta /sucursal/:sucursalId/servicios y /servicios?sucursalId=… */
  private readonly sucursalIdParam =
    this.route.snapshot.paramMap.get('sucursalId') ??
    this.route.snapshot.queryParamMap.get('sucursalId');

  /** Servicio pedido por URL para preseleccionarlo cuando exista. */
  private readonly servicioIdUrl = this.parseId(
    this.route.snapshot.paramMap.get('servicioId') ??
      this.route.snapshot.queryParamMap.get('servicioId'),
  );

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
  /** Bloquea el botón mientras el router resuelve la navegación al paso 2. */
  protected readonly navegando = signal(false);
  /** Aviso cuando el servicio pedido por URL no está en el listado. */
  protected readonly avisoPreseleccion = signal<string | null>(null);
  /** El navegador perdió la conexión: se avisa sin descartar lo ya cargado. */
  protected readonly sinConexion = signal(!this.hayConexion());

  /** Id del único servicio seleccionado en la pantalla. */
  protected readonly seleccionadoId = signal<number | null>(null);
  /** Descripciones que el usuario expandió para leerlas completas. */
  protected readonly descripcionesExpandidas = signal<ReadonlySet<number>>(new Set());
  /** Descripciones que realmente no entran en la tarjeta sin expandir. */
  protected readonly descripcionesDesbordadas = signal<ReadonlySet<number>>(new Set());
  private readonly descripcionRefs = viewChildren<ElementRef<HTMLElement>>('descripcionServicio');

  protected readonly seleccionado = computed(
    () =>
      this.servicios().find((servicio) => servicio.id === this.seleccionadoId()) ??
      null,
  );

  /** Resumen listo para mostrar con los datos del listado, sin pedir detalle. */
  protected readonly resumenSeleccion = computed(() => {
    const servicio = this.seleccionado();
    if (!servicio) {
      return null;
    }

    return {
      nombre: servicio.nombre,
      duracion: this.formatDuracion(servicio.duracion),
      precio: this.formatPrecio(servicio.precio),
    };
  });

  /** El botón «Siguiente» sólo se habilita cuando hay una tarjeta seleccionada. */
  protected readonly puedeContinuar = computed(() => this.seleccionado() !== null);

  /** Durante una recarga o navegación se evita cambiar la selección. */
  protected readonly seleccionDeshabilitada = computed(
    () => this.cargando() || this.reintentando() || this.navegando(),
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

  /** Resumen de la sucursal que acompaña al título de la pantalla. */
  protected readonly resumenSucursal = computed(() => {
    const sucursal = this.sucursal();
    const cantidadCruda = sucursal?.cantidadPuntuaciones;
    const cantidad =
      typeof cantidadCruda === 'number' &&
      Number.isFinite(cantidadCruda) &&
      cantidadCruda > 0
        ? Math.floor(cantidadCruda)
        : 0;
    const puntuacionCruda = sucursal?.puntuacion;
    const puntuacion =
      typeof puntuacionCruda === 'number' &&
      Number.isFinite(puntuacionCruda) &&
      puntuacionCruda >= 0
        ? puntuacionCruda
        : null;
    const tieneResenas = sucursal !== null && cantidad > 0 && puntuacion !== null;
    const abejas =
      cantidad > 0 && puntuacion !== null
        ? Array.from({
            length: Math.min(MAXIMO_ABEJAS, Math.max(0, Math.round(puntuacion))),
          })
        : [];

    return {
      nombre: this.nombreSucursal(),
      hayDatosSucursal: sucursal !== null,
      tieneResenas,
      abejas,
      puntuacion:
        puntuacion !== null
          ? `${FORMATO_PUNTUACION.format(puntuacion)}/${MAXIMO_ABEJAS}`
          : '',
      resenas: cantidad === 1 ? '1 reseña' : `${cantidad} reseñas`,
    };
  });

  protected readonly detalleUrl = computed<readonly (string | number)[]>(() =>
    this.sucursalId !== null ? ['/sucursal', this.sucursalId] : ['/'],
  );

  protected readonly placeholderImage = `data:image/svg+xml;utf8,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400"><rect width="640" height="400" fill="#0d1117"/><g fill="none" stroke="#98a2b3" stroke-width="3"><rect x="220" y="110" width="200" height="150" rx="16"/><circle cx="280" cy="160" r="20"/><path d="M220 230l55-50 40 34 35-28 70 60"/></g><text x="320" y="310" text-anchor="middle" fill="#98a2b3" font-size="18" font-family="sans-serif">Sin imagen</text></svg>',
  )}`;

  private readonly reintento = new Subject<void>();
  /** Evita recargar el listado más de una vez por una preselección inexistente. */
  private recargaPreseleccionHecha = false;
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
    // La decisión de mostrar «Ver más» depende del espacio real de la tarjeta,
    // no de una cantidad fija de caracteres.
    afterEveryRender(() => this.medirDescripciones());

    const idSucursal = this.sucursalId;
    if (idSucursal === null) {
      return;
    }

    // Restaura la selección previa desde el contexto temporal si sigue vigente
    // y la URL no pide un servicio concreto.
    if (this.servicioIdUrl === null) {
      const contexto = this.reservaContexto.obtener();
      if (contexto !== null && contexto.sucursalId === idSucursal && contexto.servicioId !== null) {
        this.seleccionadoId.set(contexto.servicioId);
      }
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

        if (servicios.ok) {
          this.aplicarPreseleccionDesdeUrl(this.servicios());
        }
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
    if (this.sucursalId !== null) {
      this.reservaContexto.guardar(this.sucursalId, servicio.id);
    }
  }

  protected estaSeleccionado(servicio: ServicioDTO): boolean {
    return this.seleccionadoId() === servicio.id;
  }

  /**
   * Dentro de un radiogroup sólo una opción participa del tabulador: la
   * seleccionada o, si todavía no hay selección, la primera.
   */
  protected esOpcionEnfocable(servicio: ServicioDTO): boolean {
    const idSeleccionado = this.seleccionadoId();
    if (idSeleccionado !== null) {
      return idSeleccionado === servicio.id;
    }
    return this.servicios()[0]?.id === servicio.id;
  }

  /** Navegación con flechas y activación con Enter/Espacio del grupo radio. */
  protected onTeclaOpcion(event: KeyboardEvent, servicio: ServicioDTO): void {
    if (this.seleccionDeshabilitada()) {
      return;
    }

    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      this.seleccionar(servicio);
      this.enfocarServicio(servicio.id);
      return;
    }

    const navegacion = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'];
    if (!navegacion.includes(event.key)) {
      return;
    }

    const lista = this.servicios();
    const actual = lista.findIndex((item) => item.id === servicio.id);
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
    this.enfocarServicio(siguiente.id);
  }

  /** Continúa al paso 2 del flujo de reserva: selección de profesional. */
  protected continuar(): void {
    if (this.navegando()) {
      return;
    }

    const servicio = this.seleccionado();
    if (!servicio || this.sucursalId === null) {
      return;
    }

    this.reservaContexto.guardar(this.sucursalId, servicio.id);
    this.navegando.set(true);
    this.router
      .navigate(['/sucursal', this.sucursalId, 'servicios', servicio.id, 'empleados'])
      .then((navego) => {
        if (!navego) {
          this.navegando.set(false);
        }
      })
      .catch(() => this.navegando.set(false));
  }

  protected descripcionDesbordada(servicio: ServicioDTO): boolean {
    return this.descripcionesDesbordadas().has(servicio.id);
  }

  protected estaDescripcionExpandida(idServicio: number): boolean {
    return this.descripcionesExpandidas().has(idServicio);
  }

  /**
   * Mide cada descripción mientras está colapsada. Si el texto completo supera
   * el alto de la tarjeta, se habilita «Ver más» para esa descripción.
   * Cuando la descripción ya está expandida se conserva la decisión tomada
   * antes de abrirla, para que el botón «Ver menos» siga visible.
   */
  private medirDescripciones(): void {
    const expandidas = this.descripcionesExpandidas();
    const anteriores = this.descripcionesDesbordadas();
    const siguiente = new Set<number>();

    for (const ref of this.descripcionRefs()) {
      const elemento = ref.nativeElement;
      const id = Number(elemento.dataset['descripcionId']);
      if (!Number.isInteger(id) || id <= 0) {
        continue;
      }

      if (expandidas.has(id) || this.desborda(elemento)) {
        siguiente.add(id);
      }
    }

    if (!this.mismosIds(siguiente, anteriores)) {
      this.descripcionesDesbordadas.set(siguiente);
    }
  }

  private desborda(elemento: HTMLElement): boolean {
    const altoVisible = elemento.clientHeight;
    const altoCompleto = elemento.scrollHeight;

    // En navegadores reales estas medidas existen aunque la tarjeta recién se
    // haya pintado. Si no hay layout (tests) se usa una estimación conservadora.
    if (altoVisible > 0 || altoCompleto > 0) {
      return altoCompleto > altoVisible + 1;
    }

    return (elemento.textContent?.trim().length ?? 0) > LARGO_DESCRIPCION_ESTIMADO;
  }

  private mismosIds(a: ReadonlySet<number>, b: ReadonlySet<number>): boolean {
    return a.size === b.size && [...a].every((id) => b.has(id));
  }

  @HostListener('window:resize')
  protected onResize(): void {
    this.medirDescripciones();
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

  /**
   * Preselecciona el servicio pedido por URL con los datos del listado.
   * Si no aparece, recarga una única vez el endpoint existente y vuelve a
   * verificar. Nunca deja una selección inválida ni elige otra por el usuario.
   */
  private aplicarPreseleccionDesdeUrl(lista: readonly ServicioDTO[]): void {
    const idUrl = this.servicioIdUrl;
    if (idUrl === null) {
      return;
    }

    if (lista.some((servicio) => servicio.id === idUrl)) {
      const actual = this.seleccionadoId();
      const actualValido = actual !== null && lista.some((servicio) => servicio.id === actual);

      if (!actualValido || actual === idUrl) {
        this.seleccionadoId.set(idUrl);
      }
      this.avisoPreseleccion.set(null);
      return;
    }

    const actual = this.seleccionadoId();
    const conservarSeleccion =
      actual !== null && actual !== idUrl && lista.some((servicio) => servicio.id === actual);

    if (this.recargaPreseleccionHecha) {
      if (!conservarSeleccion) {
        this.seleccionadoId.set(null);
      }
      this.avisoPreseleccion.set(
        'El servicio que intentaste preseleccionar ya no está disponible. Elegí otro servicio para continuar.',
      );
      return;
    }

    this.recargaPreseleccionHecha = true;
    if (!conservarSeleccion) {
      this.seleccionadoId.set(null);
    }
    this.avisoPreseleccion.set(
      'El servicio que intentaste preseleccionar no está en el listado. Actualizando los servicios disponibles…',
    );

    // La recarga usa el mismo endpoint del listado. El flag de arriba impide
    // que un servicio realmente inexistente genere un ciclo infinito.
    this.reintento.next();
  }

  private enfocarServicio(idServicio: number): void {
    this.host.nativeElement
      .querySelector<HTMLButtonElement>(`[data-servicio-id="${idServicio}"]`)
      ?.focus();
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
      this.reservaContexto.limpiar();
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
