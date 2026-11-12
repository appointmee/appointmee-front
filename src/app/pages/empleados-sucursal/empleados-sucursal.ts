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
import { catchError, map, startWith, switchMap } from 'rxjs/operators';

import { mensajeErrorSolicitudEmpleado } from '../../http/solicitud-empleado-errors';
import {
  EmpleadoDTO,
  EmpleadoSucursalDTO,
  combinarEmpleadosSucursal,
} from '../../models/empleado';
import { UsuarioResponseDTO } from '../../models/usuario';
import { DsButtonComponent } from '../../shared/ui/button/button.component';
import { DsModalComponent } from '../../shared/ui/misc/misc.component';
import { authService } from '../../services/auth-service';
import { empleadoService } from '../../services/empleado-service';
import { sucursalService } from '../../services/sucursal-service';

const FORMATO_PUNTUACION = new Intl.NumberFormat('es-AR', {
  maximumFractionDigits: 1,
});

const MAXIMO_ABEJAS = 5;

/** Resultado de cada consulta para poder resolver el error de forma independiente. */
type Resultado<T> =
  | { readonly ok: true; readonly datos: readonly T[] }
  | { readonly ok: false; readonly error: HttpErrorResponse };

/**
 * Pantalla de la tarjeta "Empleados" del gestor de sucursales. Muestra el
 * equipo de la sucursal en forma de lista: los datos principales salen de
 * `/sucursales/{id}/empleados` (`UsuarioResponseDTO`) y la puntuación promedio
 * de `/sucursales/{id}/elegir-empleado`, combinando ambos por identificador.
 * El empleador también puede quitar a un empleado del equipo desde el mismo
 * listado, con una confirmación previa.
 */
@Component({
  selector: 'app-empleados-sucursal',
  imports: [DsButtonComponent, DsModalComponent, RouterLink],
  templateUrl: './empleados-sucursal.html',
  styleUrl: './empleados-sucursal.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmpleadosSucursal {
  private readonly sucursalesApi = inject(sucursalService);
  private readonly empleadosApi = inject(empleadoService);
  private readonly auth = inject(authService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly sucursalId = Number(
    this.route.snapshot.paramMap.get('sucursalId') ?? '',
  );

  protected readonly sucursalIdValido =
    Number.isInteger(this.sucursalId) && this.sucursalId > 0;

  /** Empleados de la sucursal con la puntuación promedio ya combinada. */
  protected readonly empleados = signal<readonly EmpleadoSucursalDTO[]>([]);
  protected readonly cargando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly reintentando = signal(false);
  /** Aviso no bloqueante: el listado se muestra aunque fallen las puntuaciones. */
  protected readonly errorPuntuaciones = signal<string | null>(null);

  protected readonly yaEsEmpleado = signal(false);
  protected readonly agregandome = signal(false);
  protected readonly errorAgregarme = signal<string | null>(null);

  /** Empleado pendiente de confirmar en el diálogo de eliminación. */
  protected readonly empleadoAEliminar = signal<EmpleadoSucursalDTO | null>(null);
  /** Bloquea el inicio de otra eliminación mientras hay una en curso. */
  protected readonly eliminando = signal(false);
  protected readonly exitoEliminacion = signal<string | null>(null);
  protected readonly errorEliminacion = signal<string | null>(null);

  /** El equipo puede ser extenso: se informa cuántos hay en total. */
  protected readonly totalEmpleados = computed(() => this.empleados().length);

  protected readonly placeholderAvatar = `data:image/svg+xml;utf8,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240"><rect width="240" height="240" fill="#10151d"/><circle cx="120" cy="92" r="38" fill="#39424f"/><path d="M48 216c9-47 36-72 72-72s63 25 72 72" fill="#39424f"/></svg>',
  )}`;

  private readonly recargar = new Subject<void>();

  constructor() {
    if (!this.sucursalIdValido) {
      this.error.set('No pudimos identificar la sucursal solicitada.');
      this.errorAgregarme.set('No pudimos identificar la sucursal solicitada.');
      return;
    }

    this.recargar
      .pipe(
        startWith(undefined as void),
        switchMap(() => {
          this.cargando.set(this.empleados().length === 0);
          this.error.set(null);
          this.errorPuntuaciones.set(null);

          return forkJoin({
            empleados: this.sucursalesApi.listarEmpleados(this.sucursalId).pipe(
              map(
                (lista): Resultado<UsuarioResponseDTO> => ({
                  ok: true,
                  datos: lista ?? [],
                }),
              ),
              catchError((error: HttpErrorResponse) =>
                of<Resultado<UsuarioResponseDTO>>({ ok: false, error }),
              ),
            ),
            puntuaciones: this.empleadosApi.listarPorSucursal(this.sucursalId).pipe(
              map(
                (lista): Resultado<EmpleadoDTO> => ({ ok: true, datos: lista ?? [] }),
              ),
              catchError((error: HttpErrorResponse) =>
                of<Resultado<EmpleadoDTO>>({ ok: false, error }),
              ),
            ),
          });
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ empleados, puntuaciones }) => {
        this.reintentando.set(false);

        if (!empleados.ok) {
          this.empleados.set([]);
          this.yaEsEmpleado.set(false);
          this.error.set(this.mensajeErrorListado(empleados.error));
          this.errorAgregarme.set(
            'No pudimos comprobar si ya formás parte del equipo. Podés intentar agregarte; el sistema evitará duplicados.',
          );
          this.cargando.set(false);
          return;
        }

        this.error.set(null);
        this.errorPuntuaciones.set(
          puntuaciones.ok
            ? null
            : 'No pudimos cargar la puntuación promedio de los empleados.',
        );

        const lista = combinarEmpleadosSucursal(
          empleados.datos,
          puntuaciones.ok ? puntuaciones.datos : [],
        );
        this.empleados.set(lista);
        this.actualizarMembresia(lista);
        this.cargando.set(false);
      });
  }

  protected reintentar(): void {
    if (this.reintentando()) return;

    this.reintentando.set(true);
    this.recargar.next();
  }

  protected agregarmeComoEmpleado(): void {
    if (this.agregandome() || this.yaEsEmpleado() || !this.sucursalIdValido) return;

    this.agregandome.set(true);
    this.errorAgregarme.set(null);

    this.sucursalesApi
      .convertirmeEnEmpleado(this.sucursalId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.agregandome.set(false);
          this.yaEsEmpleado.set(true);
          // El listado se vuelve a pedir para que el nuevo empleado aparezca.
          this.recargar.next();
        },
        error: (error: HttpErrorResponse) => {
          this.agregandome.set(false);
          if (error.status === 409) {
            this.yaEsEmpleado.set(true);
            return;
          }
          this.errorAgregarme.set(
            mensajeErrorSolicitudEmpleado(error, 'auto-incorporacion'),
          );
        },
      });
  }

  /** Abre la confirmación de eliminación para el empleado elegido. */
  protected solicitarEliminacion(empleado: EmpleadoSucursalDTO): void {
    if (this.eliminando() || this.empleadoAEliminar()) return;

    this.exitoEliminacion.set(null);
    this.errorEliminacion.set(null);
    this.empleadoAEliminar.set(empleado);
  }

  /** Cierra la confirmación sin eliminar a nadie. */
  protected cancelarEliminacion(): void {
    if (this.eliminando()) return;

    this.empleadoAEliminar.set(null);
  }

  /** Ejecuta la eliminación confirmada y actualiza el listado. */
  protected confirmarEliminacion(): void {
    const empleado = this.empleadoAEliminar();
    if (!empleado || this.eliminando()) return;

    this.eliminando.set(true);
    this.errorEliminacion.set(null);

    this.empleadosApi
      .eliminar(this.sucursalId, empleado.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.eliminando.set(false);
          this.empleadoAEliminar.set(null);
          // El listado se actualiza en el lugar: el empleado deja de aparecer
          // sin tener que recargar la página.
          const lista = this.empleados().filter((item) => item.id !== empleado.id);
          this.empleados.set(lista);
          this.actualizarMembresia(lista);
          this.exitoEliminacion.set(
            `Eliminamos a ${this.nombreCompleto(empleado)} de la sucursal.`,
          );
        },
        error: (error: HttpErrorResponse) => {
          this.eliminando.set(false);
          this.empleadoAEliminar.set(null);
          // El empleado se mantiene en el listado cuando la eliminación falla.
          this.errorEliminacion.set(this.mensajeErrorEliminacion(error));
        },
      });
  }

  protected nombre(empleado: EmpleadoSucursalDTO): string {
    return empleado.nombre?.trim() || 'Profesional';
  }

  protected apellido(empleado: EmpleadoSucursalDTO): string {
    return empleado.apellido?.trim() || '';
  }

  protected nombreCompleto(empleado: EmpleadoSucursalDTO): string {
    return [this.nombre(empleado), this.apellido(empleado)].filter(Boolean).join(' ');
  }

  protected email(empleado: EmpleadoSucursalDTO): string {
    return empleado.email?.trim() || 'Sin correo electrónico';
  }

  protected foto(empleado: EmpleadoSucursalDTO): string {
    return empleado.urlFotoPerfil?.trim() || this.placeholderAvatar;
  }

  protected onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.onerror = null;
    img.src = this.placeholderAvatar;
  }

  protected tienePuntuacion(empleado: EmpleadoSucursalDTO): boolean {
    const cantidad = empleado.cantidadPuntuaciones;
    return (
      typeof cantidad === 'number' &&
      Number.isFinite(cantidad) &&
      cantidad > 0 &&
      typeof empleado.puntuacion === 'number' &&
      Number.isFinite(empleado.puntuacion)
    );
  }

  protected puntuacion(empleado: EmpleadoSucursalDTO): number {
    const valor = empleado.puntuacion;
    return typeof valor === 'number' && Number.isFinite(valor)
      ? Math.max(0, Math.min(MAXIMO_ABEJAS, Math.round(valor)))
      : 0;
  }

  protected puntuacionTexto(empleado: EmpleadoSucursalDTO): string {
    if (!this.tienePuntuacion(empleado)) {
      return '';
    }

    const valor = empleado.puntuacion;
    return typeof valor === 'number'
      ? `${FORMATO_PUNTUACION.format(valor)}/${MAXIMO_ABEJAS}`
      : '';
  }

  protected cantidadResenias(empleado: EmpleadoSucursalDTO): string {
    const cantidad = empleado.cantidadPuntuaciones;
    if (typeof cantidad !== 'number' || !Number.isFinite(cantidad) || cantidad <= 0) {
      return '';
    }

    return cantidad === 1 ? '1 reseña' : `${cantidad} reseñas`;
  }

  /** Cinco abejas: se llenan mientras la puntuación alcance la posición. */
  protected abejas(empleado: EmpleadoSucursalDTO): readonly boolean[] {
    if (!this.tienePuntuacion(empleado)) {
      return [];
    }

    const puntuacion = this.puntuacion(empleado);
    return Array.from({ length: MAXIMO_ABEJAS }, (_, indice) => indice < puntuacion);
  }

  protected trackById(_index: number, empleado: EmpleadoSucursalDTO): number {
    return empleado.id;
  }

  protected readonly volverLink = ['/mis-sucursales'];

  /** Marca si el empleador actual ya forma parte del equipo de la sucursal. */
  private actualizarMembresia(lista: readonly EmpleadoSucursalDTO[]): void {
    const perfil = this.auth.perfil();
    if (!perfil) {
      this.yaEsEmpleado.set(false);
      return;
    }

    const emailPerfil = perfil.email?.trim().toLowerCase();
    this.yaEsEmpleado.set(
      lista.some(
        (empleado) =>
          empleado.id === perfil.id ||
          (!!emailPerfil &&
            empleado.email?.trim().toLowerCase() === emailPerfil),
      ),
    );
  }

  private mensajeErrorListado(error: HttpErrorResponse): string {
    if (error.status === 401) {
      return 'Necesitás iniciar sesión para ver los empleados de esta sucursal.';
    }

    if (error.status === 403) {
      return 'Tu cuenta no tiene permiso para ver los empleados de esta sucursal.';
    }

    if (error.status === 404) {
      return 'No encontramos la sucursal solicitada.';
    }

    if (error.status === 0) {
      return 'No pudimos conectar con el servidor. Revisá tu conexión e intentá de nuevo.';
    }

    return 'No pudimos cargar los empleados de esta sucursal. Intentá de nuevo en unos segundos.';
  }

  private mensajeErrorEliminacion(error: HttpErrorResponse): string {
    if (error.status === 401) {
      return 'Tu sesión expiró. Iniciá sesión nuevamente para eliminar empleados.';
    }

    if (error.status === 403) {
      return 'Solo el empleador de esta sucursal puede eliminar empleados.';
    }

    if (error.status === 404) {
      return 'No encontramos al empleado que querés eliminar.';
    }

    if (error.status === 409) {
      return 'Ese empleado ya no forma parte del equipo de la sucursal.';
    }

    if (error.status === 0) {
      return 'No pudimos conectar con el servidor. Revisá tu conexión e intentá de nuevo.';
    }

    return 'No pudimos eliminar al empleado. Intentá de nuevo en unos segundos.';
  }
}
