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
import { RouterLink } from '@angular/router';
import { Subject, catchError, map, of, startWith, switchMap } from 'rxjs';

import { humanizarCategoria } from '../../models/solicitud-empleado';
import { SucursalMiniDTO } from '../../models/sucursal';
import { sucursalService } from '../../services/sucursal-service';

@Component({
  selector: 'app-mis-sucursales',
  imports: [RouterLink],
  templateUrl: './mis-sucursales.html',
  styleUrl: './mis-sucursales.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MisSucursales {
  private readonly sucursalesApi = inject(sucursalService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly recargar = new Subject<void>();

  protected readonly sucursales = signal<readonly SucursalMiniDTO[]>([]);
  protected readonly cargandoSucursales = signal(true);
  protected readonly errorSucursales = signal<string | null>(null);
  protected readonly reintentandoSucursales = signal(false);

  protected readonly sucursalSeleccionadaId = signal<number | null>(null);

  protected readonly sucursalSeleccionada = computed(() =>
    this.sucursales().find((sucursal) => sucursal.id === this.sucursalSeleccionadaId()) ?? null,
  );

  protected readonly humanizarCategoria = humanizarCategoria;

  constructor() {
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
  }

  protected volverALista(): void {
    this.sucursalSeleccionadaId.set(null);
  }
}