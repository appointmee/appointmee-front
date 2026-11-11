import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Subject, catchError, map, of, startWith, switchMap } from 'rxjs';

import { DsButtonComponent } from '../../shared/ui/button/button.component';
import { humanizarCategoria } from '../../models/solicitud-empleado';
import { SucursalMiniDTO } from '../../models/sucursal';
import { sucursalService } from '../../services/sucursal-service';

const NOMBRES_DIAS: Readonly<Record<string, string>> = {
  MONDAY: 'Lunes',
  TUESDAY: 'Martes',
  WEDNESDAY: 'Miércoles',
  THURSDAY: 'Jueves',
  FRIDAY: 'Viernes',
  SATURDAY: 'Sábado',
  SUNDAY: 'Domingo',
};

type ResultadoSucursales =
  | {
      readonly ok: true;
      readonly sucursales: readonly SucursalMiniDTO[];
    }
  | {
      readonly ok: false;
      readonly error: unknown;
    };

/**
 * US-TUR-02: sucursales donde el usuario autenticado trabaja como empleado.
 * Cada tarjeta es un acceso completo a los turnos asignados de esa sucursal.
 */
@Component({
  selector: 'app-turnos-asignados',
  imports: [DsButtonComponent, RouterLink],
  templateUrl: './turnos-asignados.html',
  styleUrl: './turnos-asignados.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TurnosAsignados {
  private readonly sucursalesApi = inject(sucursalService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly recargar = new Subject<void>();

  protected readonly sucursales = signal<readonly SucursalMiniDTO[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly reintentando = signal(false);
  private readonly fotosFallidas = signal<ReadonlySet<string>>(new Set());

  constructor() {
    this.recargar
      .pipe(
        startWith(void 0),
        switchMap(() => {
          this.cargando.set(this.sucursales().length === 0 && !this.error());
          return this.sucursalesApi.listarComoEmpleado().pipe(
            map(
              (sucursales): ResultadoSucursales => ({ ok: true, sucursales }),
            ),
            catchError((error: unknown) =>
              of<ResultadoSucursales>({ ok: false, error }),
            ),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((resultado) => this.aplicar(resultado));
  }

  protected reintentar(): void {
    if (this.reintentando() || this.cargando()) return;
    this.reintentando.set(true);
    this.recargar.next();
  }

  protected categoria(sucursal: SucursalMiniDTO): string {
    return humanizarCategoria(sucursal.categoria);
  }

  protected diasApertura(sucursal: SucursalMiniDTO): string {
    const dias = (sucursal.diasApertura ?? [])
      .map((dia) => NOMBRES_DIAS[dia?.toUpperCase?.() ?? ''] ?? null)
      .filter((dia): dia is string => dia !== null);

    return dias.length > 0 ? dias.join(', ') : 'Sin días configurados';
  }

  protected puntuacion(sucursal: SucursalMiniDTO): string {
    return sucursal.puntuacion === null
      ? 'Sin reseñas'
      : `${sucursal.puntuacion.toFixed(1)} de 5`;
  }

  protected cantidadResenias(sucursal: SucursalMiniDTO): string {
    return sucursal.cantidadPuntuaciones === 1
      ? '1 reseña'
      : `${sucursal.cantidadPuntuaciones} reseñas`;
  }

  protected inicial(sucursal: SucursalMiniDTO): string {
    return sucursal.nombre.trim().charAt(0).toUpperCase() || '🐝';
  }

  protected fotoVisible(sucursal: SucursalMiniDTO): string | null {
    const foto = sucursal.fotoPerfil?.trim();
    return foto && !this.fotosFallidas().has(foto) ? foto : null;
  }

  protected onFotoError(foto: string): void {
    this.fotosFallidas.update((actuales) => {
      const siguientes = new Set(actuales);
      siguientes.add(foto);
      return siguientes;
    });
  }

  private aplicar(resultado: ResultadoSucursales): void {
    if (!resultado.ok) {
      this.error.set(this.mensajeError(resultado.error));
      this.cargando.set(false);
      this.reintentando.set(false);
      return;
    }

    this.sucursales.set(resultado.sucursales);
    this.error.set(null);
    this.cargando.set(false);
    this.reintentando.set(false);
  }

  private mensajeError(error: unknown): string {
    const status =
      error instanceof HttpErrorResponse
        ? error.status
        : (error as { status?: number } | null)?.status;

    if (status === 0) {
      return 'No pudimos conectarnos. Revisá tu conexión e intentá nuevamente.';
    }
    if (status === 403) {
      return 'No tenés permisos para consultar tus sucursales asignadas.';
    }
    if (status === 404) {
      return 'No encontramos tus sucursales asignadas.';
    }
    return 'No pudimos cargar tus sucursales asignadas. Probá de nuevo en unos segundos.';
  }
}
