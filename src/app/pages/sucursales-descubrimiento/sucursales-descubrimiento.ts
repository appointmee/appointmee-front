import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { CarruselSucursales } from '../../components/carrusel-sucursales/carrusel-sucursales';
import { RecomendacionesSucursalesDTO, SucursalMiniDTO } from '../../models/sucursal';
import { sucursalService } from '../../services/sucursal-service';
import { DsButtonComponent } from '../../shared/ui/button/button.component';

interface SeccionDescubrimiento {
  readonly id: string;
  readonly titulo: string;
  readonly descripcion: string;
  readonly sucursales: readonly SucursalMiniDTO[];
  readonly verTodas: boolean;
  readonly etiquetaVerTodas: string;
}

/** Pantalla principal de Sucursales: descubrimiento por secciones, sin filtros. */
@Component({
  selector: 'app-sucursales-descubrimiento',
  imports: [DsButtonComponent, CarruselSucursales, RouterLink],
  templateUrl: './sucursales-descubrimiento.html',
  styleUrl: './sucursales-descubrimiento.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SucursalesDescubrimiento {
  private readonly sucursalesService = inject(sucursalService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly recomendaciones = signal<RecomendacionesSucursalesDTO | null>(null);
  protected readonly recomendacionesLoading = signal(true);
  protected readonly recomendacionesError = signal<string | null>(null);
  protected readonly reintentandoRecomendaciones = signal(false);

  /** Las secciones sin resultados no se renderizan. «Todas» es una vista
   * previa del listado completo y siempre ofrece el acceso a la página. */
  protected readonly secciones = computed<readonly SeccionDescubrimiento[]>(() => {
    const datos = this.recomendaciones();
    if (!datos) {
      return [];
    }

    return [
      {
        id: 'mejores',
        titulo: 'Las mejores de AppointMee',
        descripcion: 'Las más valoradas por la comunidad, según reseñas y puntuación.',
        sucursales: datos.mejores ?? [],
        verTodas: false,
        etiquetaVerTodas: '',
      },
      {
        id: 'demandadas',
        titulo: 'Las más demandadas',
        descripcion: 'Las sucursales con más turnos confirmados en los últimos 30 días.',
        sucursales: datos.masDemandadas ?? [],
        verTodas: false,
        etiquetaVerTodas: '',
      },
      {
        id: 'nuevas',
        titulo: 'Nuevas en AppointMee',
        descripcion: 'Establecimientos que se sumaron en los últimos dos meses.',
        sucursales: datos.nuevas ?? [],
        verTodas: false,
        etiquetaVerTodas: '',
      },
      {
        id: 'recientes',
        titulo: 'Visto recientemente',
        descripcion: 'Volvé a las sucursales que visitaste últimamente.',
        sucursales: datos.vistasRecientes ?? [],
        verTodas: false,
        etiquetaVerTodas: '',
      },
      {
        id: 'para-vos',
        titulo: 'Recomendado para vos',
        descripcion: 'Sugerencias según tus reservas y tus categorías preferidas.',
        sucursales: datos.paraVos ?? [],
        verTodas: false,
        etiquetaVerTodas: '',
      },
      {
        id: 'todas',
        titulo: 'Todas las sucursales',
        descripcion: 'Un adelanto de todo lo que podés reservar en AppointMee.',
        sucursales: datos.todas ?? [],
        verTodas: true,
        etiquetaVerTodas: 'Ver todas',
      },
    ].filter((seccion) => seccion.sucursales.length > 0);
  });

  constructor() {
    this.cargarRecomendaciones();
  }

  protected reintentarRecomendaciones(): void {
    if (this.reintentandoRecomendaciones()) {
      return;
    }
    this.reintentandoRecomendaciones.set(true);
    this.cargarRecomendaciones();
  }

  private cargarRecomendaciones(): void {
    this.recomendacionesLoading.set(true);
    this.recomendaciones.set(null);

    this.sucursalesService
      .recomendaciones()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (datos) => {
          this.recomendaciones.set(datos);
          this.recomendacionesError.set(null);
          this.recomendacionesLoading.set(false);
          this.reintentandoRecomendaciones.set(false);
        },
        error: () => {
          this.recomendacionesError.set(
            'No pudimos cargar las recomendaciones. Revisá tu conexión e intentá de nuevo.',
          );
          this.recomendacionesLoading.set(false);
          this.reintentandoRecomendaciones.set(false);
        },
      });
  }
}
