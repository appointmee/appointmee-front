import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, Subject, catchError, map, of, startWith, switchMap, tap } from 'rxjs';

import { ErrorPage } from '../error/error';
import { ReseniasSucursal } from '../../components/resenias-sucursal/resenias-sucursal';
import { apiErrorsService } from '../../http/api-errors-service';
import { SucursalDetalleDTO } from '../../models/sucursal';
import { authService } from '../../services/auth-service';
import { sucursalService } from '../../services/sucursal-service';

type CargaResultado =
  | { readonly estado: 'ok'; readonly sucursal: SucursalDetalleDTO }
  | { readonly estado: 'no-encontrada' }
  | { readonly estado: 'sin-conexion' }
  | { readonly estado: 'error'; readonly mensaje: string };

const NOMBRES_DIAS: Readonly<Record<string, string>> = {
  MONDAY: 'Lunes',
  TUESDAY: 'Martes',
  WEDNESDAY: 'Miércoles',
  THURSDAY: 'Jueves',
  FRIDAY: 'Viernes',
  SATURDAY: 'Sábado',
  SUNDAY: 'Domingo',
};

const HORA_VALIDA = /^([01]\d|2[0-3]):[0-5]\d$/;
const LARGO_DESCRIPCION_COLGADA = 280;

@Component({
  selector: 'app-sucursal-detalle',
  imports: [ErrorPage, ReseniasSucursal, RouterLink],
  templateUrl: './sucursal-detalle.html',
  styleUrl: './sucursal-detalle.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SucursalDetalle {
  private readonly service = inject(sucursalService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(authService);
  private readonly title = inject(Title);
  private readonly apiErrors = inject(apiErrorsService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly placeholderImage = `data:image/svg+xml;utf8,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="700" viewBox="0 0 1600 700"><rect width="1600" height="700" fill="#10151d"/><g fill="none" stroke="#98a2b3" stroke-width="3" opacity="0.7"><rect x="590" y="210" width="420" height="280" rx="24"/><circle cx="700" cy="290" r="36"/><path d="M590 420l110-100 90 75 70-60 150 150"/></g><text x="800" y="560" text-anchor="middle" fill="#98a2b3" font-size="30" font-family="sans-serif">Sin imagen disponible</text></svg>',
  )}`;

  protected readonly sucursal = signal<SucursalDetalleDTO | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly noEncontrada = signal(false);
  protected readonly sinConexion = signal(false);
  protected readonly reintentando = signal(false);
  protected readonly descripcionExpandida = signal(false);
  /** Bloquea el CTA mientras el router resuelve la navegación. */
  protected readonly navegando = signal(false);
  /** Mensaje específico para una sesión autenticada sin rol CLIENTE. */
  protected readonly avisoRol = signal<string | null>(null);

  protected readonly ayudaReserva = 'Elegí el servicio, el profesional y el horario.';

  private readonly recargar$ = new Subject<boolean>();

  protected readonly tituloError = computed(() =>
    this.sinConexion() ? 'Sin conexión a internet' : 'No pudimos mostrar la sucursal',
  );

  protected readonly categoria = computed(() => this.humanizarCategoria(this.sucursal()?.categoria));

  protected readonly descripcion = computed(() => this.sucursal()?.descripcion?.trim() ?? '');

  protected readonly descripcionLarga = computed(
    () => this.descripcion().length > LARGO_DESCRIPCION_COLGADA,
  );

  protected readonly horario = computed(() => {
    const actual = this.sucursal();
    const apertura = actual?.horaApertura?.trim() ?? '';
    const cierre = actual?.horaCierre?.trim() ?? '';

    if (!HORA_VALIDA.test(apertura) || !HORA_VALIDA.test(cierre)) {
      return null;
    }

    return { apertura, cierre };
  });

  protected readonly dias = computed(() => {
    const nombres = this.sucursal()?.diasApertura ?? [];
    return nombres
      .map((dia) => NOMBRES_DIAS[dia?.toUpperCase?.() ?? ''] ?? null)
      .filter((dia): dia is string => !!dia);
  });

  protected readonly telefono = computed(() => this.sucursal()?.telefono?.trim() ?? '');

  protected readonly telefonoHref = computed(() => {
    const limpio = this.telefono()
      .replace(/[^\d+]/g, '')
      .replace(/(?!^)\+/g, '');
    return /\d/.test(limpio) ? `tel:${limpio}` : null;
  });

  protected readonly puntuacion = computed(() => {
    const valor = this.sucursal()?.puntuacion;
    return typeof valor === 'number' && Number.isFinite(valor)
      ? Math.round(Math.max(0, Math.min(5, valor)) * 10) / 10
      : 0;
  });

  protected readonly cantidadPuntuaciones = computed(() => {
    const valor = this.sucursal()?.cantidadPuntuaciones;
    return typeof valor === 'number' && Number.isFinite(valor) && valor > 0 ? valor : 0;
  });

  protected readonly hayPuntuaciones = computed(
    () => this.cantidadPuntuaciones() > 0 && this.sucursal()?.puntuacion !== null,
  );

  protected readonly abejas = computed(() =>
    [1, 2, 3, 4, 5].map((posicion) => posicion <= this.puntuacion()),
  );

  constructor() {
    this.route.paramMap
      .pipe(
        map((params) => params.get('id')),
        switchMap((id) =>
          this.recargar$.pipe(
            startWith(false),
            map((esReintento) => ({ id, esReintento })),
          ),
        ),
        tap(({ esReintento }) => {
          if (esReintento) {
            this.reintentando.set(true);
          } else {
            this.reiniciarEstado();
          }
        }),
        switchMap(({ id }) => this.cargar(id)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((resultado) => this.aplicarResultado(resultado));
  }

  protected reintentar(): void {
    if (this.reintentando() || !this.error()) {
      return;
    }

    this.recargar$.next(true);
  }

  /**
   * Inicia la reserva desde el detalle:
   * - cliente autenticado: va directo a elegir servicio;
   * - visitante: va al login conservando el destino;
   * - sesión sin rol CLIENTE: muestra un aviso específico en vez de un 403.
   */
  protected iniciarReserva(): void {
    if (this.navegando()) {
      return;
    }

    const sucursal = this.sucursal();
    if (!sucursal) {
      return;
    }

    this.avisoRol.set(null);

    if (this.auth.autenticado() && !this.auth.tieneAlgunRol('CLIENTE')) {
      this.avisoRol.set(
        'Tu cuenta no tiene el rol Cliente, necesario para reservar. Ingresá con una cuenta de cliente para continuar.',
      );
      return;
    }

    const destino = `/sucursal/${sucursal.id}/servicios`;
    this.navegando.set(true);

    const navegacion = this.auth.autenticado()
      ? this.router.navigateByUrl(destino)
      : this.router.navigate(['/login'], { queryParams: { returnTo: destino } });

    void navegacion.then((navego) => {
      if (!navego) {
        this.navegando.set(false);
      }
    });
  }

  protected alternarDescripcion(): void {
    this.descripcionExpandida.update((expandida) => !expandida);
  }

  protected onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img.src !== this.placeholderImage) {
      img.src = this.placeholderImage;
    }
  }

  private cargar(idParam: string | null): Observable<CargaResultado> {
    const id = Number(idParam);

    if (!idParam || !/^\d+$/.test(idParam) || !Number.isInteger(id) || id <= 0) {
      return of<CargaResultado>({ estado: 'no-encontrada' });
    }

    return this.service.obtenerPorId(id, true).pipe(
      map((sucursal): CargaResultado => ({ estado: 'ok', sucursal })),
      catchError((err: HttpErrorResponse) => of(this.mapearError(err))),
    );
  }

  private mapearError(err: HttpErrorResponse): CargaResultado {
    // La pantalla muestra el error con su propio reintento: se evita el aviso global duplicado.
    this.apiErrors.dismiss();

    if (err.status === 404) {
      return { estado: 'no-encontrada' };
    }

    if (err.status === 0) {
      return { estado: 'sin-conexion' };
    }

    return {
      estado: 'error',
      mensaje: 'No pudimos cargar la información de la sucursal. Intentá de nuevo en unos segundos.',
    };
  }

  private aplicarResultado(resultado: CargaResultado): void {
    this.reintentando.set(false);

    switch (resultado.estado) {
      case 'ok':
        this.sucursal.set(resultado.sucursal);
        this.error.set(null);
        this.noEncontrada.set(false);
        this.sinConexion.set(false);
        this.title.setTitle(`AppointMee | ${resultado.sucursal.nombre}`);
        break;
      case 'no-encontrada':
        this.sucursal.set(null);
        this.error.set(null);
        this.noEncontrada.set(true);
        this.sinConexion.set(false);
        break;
      case 'sin-conexion':
        this.sucursal.set(null);
        this.error.set(
          'No pudimos conectarnos. Revisá tu conexión a internet e intentá de nuevo.',
        );
        this.noEncontrada.set(false);
        this.sinConexion.set(true);
        break;
      case 'error':
        this.sucursal.set(null);
        this.error.set(resultado.mensaje);
        this.noEncontrada.set(false);
        this.sinConexion.set(false);
        break;
    }

    this.loading.set(false);
  }

  private reiniciarEstado(): void {
    this.sucursal.set(null);
    this.error.set(null);
    this.noEncontrada.set(false);
    this.sinConexion.set(false);
    this.reintentando.set(false);
    this.descripcionExpandida.set(false);
    this.navegando.set(false);
    this.avisoRol.set(null);
    this.loading.set(true);
  }

  private humanizarCategoria(categoria: string | null | undefined): string {
    if (!categoria) {
      return '';
    }

    return categoria
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }
}
