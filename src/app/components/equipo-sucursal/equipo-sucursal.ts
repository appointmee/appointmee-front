import { DsButtonComponent } from '../../shared/ui/button/button.component';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { Observable, Subject, catchError, map, of, startWith, switchMap, tap } from 'rxjs';

import { apiErrorsService } from '../../http/api-errors-service';
import { EmpleadoDTO } from '../../models/empleado';
import { empleadoService } from '../../services/empleado-service';

const LIMITE_DETALLE = 5;
const ESCALA_TEXTO: Readonly<Record<number, string>> = {
  1: 'Mala',
  2: 'Regular',
  3: 'Buena',
  4: 'Muy buena',
  5: 'Excelente',
};

@Component({
  selector: 'app-equipo-sucursal',
  imports: [DsButtonComponent, RouterLink],
  templateUrl: './equipo-sucursal.html',
  styleUrl: './equipo-sucursal.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EquipoSucursal {
  private readonly service = inject(empleadoService);
  private readonly apiErrors = inject(apiErrorsService);
  private readonly destroyRef = inject(DestroyRef);

  readonly sucursalId = input.required<number>();
  readonly limite = input<number | null>(LIMITE_DETALLE);
  readonly mostrarVerMas = input(true);

  protected readonly empleados = signal<readonly EmpleadoDTO[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly placeholderAvatar = `data:image/svg+xml;utf8,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240"><rect width="240" height="240" fill="#10151d"/><circle cx="120" cy="92" r="38" fill="#39424f"/><path d="M48 216c9-47 36-72 72-72s63 25 72 72" fill="#39424f"/></svg>',
  )}`;

  private readonly recargar$ = new Subject<void>();

  protected readonly visibles = computed(() => {
    const limite = this.limite();
    if (limite === null || !Number.isFinite(limite) || limite < 0) {
      return this.empleados();
    }
    return this.empleados().slice(0, Math.floor(limite));
  });

  protected readonly hayEmpleados = computed(() => this.empleados().length > 0);

  protected readonly hayMas = computed(() => {
    const limite = this.limite();
    return (
      this.mostrarVerMas() &&
      limite !== null &&
      Number.isFinite(limite) &&
      limite >= 0 &&
      this.empleados().length > limite
    );
  });

  constructor() {
    toObservable(this.sucursalId)
      .pipe(
        switchMap((id) => this.recargar$.pipe(startWith(undefined), map(() => id))),
        tap(() => {
          this.loading.set(true);
          this.error.set(null);
        }),
        switchMap((id) => this.cargar(id)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((lista) => {
        this.empleados.set(lista);
        this.loading.set(false);
      });
  }

  protected reintentar(): void {
    this.recargar$.next();
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
    return this.normalizarPuntuacion(empleado.puntuacion);
  }

  protected abejas(empleado: EmpleadoDTO): readonly boolean[] {
    if (!this.tienePuntuacion(empleado)) {
      return [];
    }

    const puntuacion = this.puntuacion(empleado);
    return [1, 2, 3, 4, 5].map((posicion) => posicion <= puntuacion);
  }

  protected etiqueta(empleado: EmpleadoDTO): string {
    return ESCALA_TEXTO[this.puntuacion(empleado)] ?? 'Sin puntuación';
  }

  protected onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img.src !== this.placeholderAvatar) {
      img.src = this.placeholderAvatar;
    }
  }

  private cargar(id: number): Observable<readonly EmpleadoDTO[]> {
    if (!Number.isInteger(id) || id <= 0) {
      return of([]);
    }

    return this.service.listarPorSucursal(id).pipe(
      map((lista) => lista ?? []),
      catchError((error: HttpErrorResponse) => {
        // La sección informa el problema sin interrumpir el resto del detalle.
        this.apiErrors.dismiss();
        this.error.set(this.mensajeError(error));
        return of<readonly EmpleadoDTO[]>([]);
      }),
    );
  }

  private normalizarPuntuacion(valor: number | null | undefined): number {
    return typeof valor === 'number' && Number.isFinite(valor)
      ? Math.max(0, Math.min(5, Math.round(valor)))
      : 0;
  }

  private mensajeError(error: HttpErrorResponse): string {
    if (error.status === 0) {
      return 'No pudimos conectarnos para cargar al equipo. Revisá tu conexión e intentá de nuevo.';
    }

    if (error.status === 401) {
      return 'Tu sesión expiró. Iniciá sesión nuevamente para ver al equipo.';
    }

    return 'No pudimos cargar al equipo de esta sucursal. Intentá de nuevo en unos segundos.';
  }
}
