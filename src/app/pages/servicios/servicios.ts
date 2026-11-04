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

@Component({
  selector: 'app-servicios',
  imports: [RouterLink],
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
  protected readonly reintentando = signal(false);

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

  constructor() {
    const idSucursal = this.sucursalId;
    if (idSucursal === null) {
      return;
    }

    this.reintento
      .pipe(
        startWith(undefined as void),
        tap(() => {
          // En un reintento se mantiene el error inline (y el nombre de la
          // sucursal) hasta tener una respuesta; el skeleton es sólo la carga
          // inicial.
          this.cargando.set(this.error() === null);
          this.requiereLogin.set(false);
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
          this.servicios.set(servicios.servicios);
        } else {
          this.servicios.set([]);
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
    const valor = typeof precio === 'string' ? Number(precio) : precio;
    if (valor === null || valor === undefined || !Number.isFinite(valor)) {
      return 'Precio a confirmar';
    }

    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    }).format(valor);
  }

  protected trackById(_index: number, servicio: ServicioDTO): number {
    return servicio.id;
  }

  private aplicarError(error: HttpErrorResponse): void {
    if (error.status === 401) {
      this.error.set('Necesitás iniciar sesión para ver los servicios de esta sucursal.');
      this.requiereLogin.set(true);
      return;
    }

    if (error.status === 0) {
      this.error.set(
        'No pudimos conectar con el backend. Verificá que esté corriendo en http://localhost:8080 y que uses npm start (puerto 4200).',
      );
      return;
    }

    if (error.status === 404) {
      this.error.set('No encontramos la sucursal solicitada.');
      return;
    }

    this.error.set(`No pudimos cargar los servicios de ${this.nombreSucursal()}.`);
  }

  private parseId(value: string | null): number | null {
    if (!value?.trim()) {
      return null;
    }

    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
  }
}
