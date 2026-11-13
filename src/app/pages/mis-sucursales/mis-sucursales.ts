import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject, catchError, map, of, startWith, switchMap } from 'rxjs';

import { humanizarCategoria } from '../../models/solicitud-empleado';
import { SucursalMiniDTO } from '../../models/sucursal';
import { sucursalService } from '../../services/sucursal-service';
import { SucursalDetalleModal } from '../../components/sucursal-detalle-modal/sucursal-detalle-modal';

@Component({
  selector: 'app-mis-sucursales',
  imports: [RouterLink, SucursalDetalleModal],
  templateUrl: './mis-sucursales.html',
  styleUrl: './mis-sucursales.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MisSucursales {
  private readonly sucursalesApi = inject(sucursalService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly recargar = new Subject<void>();
  private readonly detalleSucursal = viewChild(SucursalDetalleModal);

  protected readonly sucursales = signal<readonly SucursalMiniDTO[]>([]);
  protected readonly cargandoSucursales = signal(true);
  protected readonly errorSucursales = signal<string | null>(null);
  protected readonly reintentandoSucursales = signal(false);
  protected readonly fotosSucursalFallidas = signal<ReadonlySet<string>>(new Set());

  protected readonly sucursalSeleccionadaId = signal<number | null>(null);
  protected readonly sucursalResaltadaId = signal<number | null>(null);
  /** El recuadro con los datos de la sucursal está abierto. */
  protected readonly detalleSucursalAbierto = signal(false);
  /** Mensaje de éxito de la última sucursal eliminada. */
  protected readonly exitoEliminacion = signal<string | null>(null);

  protected readonly sucursalSeleccionada = computed(() =>
    this.sucursales().find((sucursal) => sucursal.id === this.sucursalSeleccionadaId()) ?? null,
  );

  protected readonly sucursalDeFondo = computed(() =>
    this.sucursalSeleccionada()
      ?? this.sucursales().find((sucursal) => sucursal.id === this.sucursalResaltadaId())
      ?? null,
  );
  protected readonly fotoFondo = computed(() => {
    const sucursal = this.sucursalDeFondo();
    return sucursal ? this.fotoPrincipal(sucursal) : null;
  });

  protected readonly puntuacion = computed(() => {
    const valor = this.sucursalSeleccionada()?.puntuacion;
    return typeof valor === 'number' && Number.isFinite(valor)
      ? Math.max(0, Math.min(5, Math.round(valor)))
      : 0;
  });

  protected readonly cantidadResenias = computed(() => {
    const valor = this.sucursalSeleccionada()?.cantidadPuntuaciones;
    return typeof valor === 'number' && Number.isFinite(valor) && valor > 0 ? valor : 0;
  });

  protected readonly abejas = computed(() =>
    [1, 2, 3, 4, 5].map((posicion) => posicion <= this.puntuacion()),
  );

  protected readonly humanizarCategoria = humanizarCategoria;

  protected fotoPrincipal(sucursal: SucursalMiniDTO): string | null {
    const foto = sucursal.fotoPerfil?.trim();
    return foto && !this.fotosSucursalFallidas().has(foto) ? foto : null;
  }

  protected onFotoSucursalError(foto: string): void {
    this.fotosSucursalFallidas.update((fallidas) => new Set(fallidas).add(foto));
  }

  constructor() {
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const id = Number(params.get('sucursalId'));
        if (Number.isInteger(id) && id > 0) {
          this.sucursalSeleccionadaId.set(id);
        }
      });

    this.recargar
      .pipe(
        startWith(undefined as void),
        switchMap(() => {
          this.cargandoSucursales.set(this.sucursales().length === 0);
          return this.sucursalesApi.listarPropias().pipe(
            map((sucursales) => ({ ok: true as const, sucursales })),
            catchError((error: HttpErrorResponse) =>
              of({ ok: false as const, error }),
            ),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((resultado) => {
        if (!resultado.ok) {
          this.errorSucursales.set('No pudimos cargar tus sucursales.');
          this.cargandoSucursales.set(false);
          this.reintentandoSucursales.set(false);
          return;
        }

        this.errorSucursales.set(null);
        this.sucursales.set(resultado.sucursales);
        this.cargandoSucursales.set(false);
        this.reintentandoSucursales.set(false);
      });
  }

  protected reintentarSucursales(): void {
    if (this.reintentandoSucursales()) return;
    this.reintentandoSucursales.set(true);
    this.recargar.next();
  }

  protected seleccionarSucursal(id: number): void {
    this.sucursalSeleccionadaId.set(id);
    this.sucursalResaltadaId.set(null);
    this.detalleSucursalAbierto.set(false);
    this.exitoEliminacion.set(null);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { sucursalId: id },
      queryParamsHandling: 'merge',
    });
  }

  protected resaltarSucursal(sucursal: SucursalMiniDTO): void {
    if (!this.sucursalSeleccionada()) this.sucursalResaltadaId.set(sucursal.id);
  }

  protected limpiarSucursalResaltada(): void {
    this.sucursalResaltadaId.set(null);
  }

  /** Abre el recuadro con los datos de la sucursal seleccionada. */
  protected abrirDetalleSucursal(): void {
    if (!this.sucursalSeleccionadaId()) return;
    this.detalleSucursalAbierto.set(true);
  }

  /** Cierra el recuadro con los datos de la sucursal. */
  protected cerrarDetalleSucursal(): void {
    this.detalleSucursalAbierto.set(false);
  }

  /** La sucursal fue modificada: se refresca el listado para ver los cambios. */
  protected refrescarSucursales(): void {
    this.recargar.next();
  }

  /**
   * La sucursal fue eliminada: se avisa, se vuelve al listado y se vuelve a
   * pedir para que la sucursal eliminada ya no aparezca. El listado no se
   * vacía antes de que el backend confirme la eliminación.
   */
  protected onSucursalEliminada(): void {
    this.exitoEliminacion.set('La sucursal se eliminó correctamente');
    this.detalleSucursalAbierto.set(false);
    this.sucursalSeleccionadaId.set(null);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { sucursalId: null },
      queryParamsHandling: 'merge',
    });
    this.recargar.next();
  }

  protected volverALista(): void {
    // Si el formulario de modificación tiene cambios sin guardar, se pide
    // confirmación antes de volver al listado y perderlos.
    if (this.detalleSucursal()?.tieneCambiosSinGuardar()) {
      this.detalleSucursal()?.solicitarCierreEdicion();
      return;
    }

    this.sucursalSeleccionadaId.set(null);
    this.detalleSucursalAbierto.set(false);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { sucursalId: null },
      queryParamsHandling: 'merge',
    });
  }
}
