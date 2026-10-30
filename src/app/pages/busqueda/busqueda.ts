import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';

/**
 * Endpoint de resultados de búsqueda (`/busqueda?q=...`).
 * Placeholder: muestra el término buscado hasta que la US de resultados aterrice.
 * Compone el path que la vista 404 usa para su buscador y su CTA de sucursal.
 */
@Component({
  selector: 'app-busqueda',
  imports: [RouterLink],
  templateUrl: './busqueda.html',
  styleUrl: './busqueda.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BusquedaPage {
  private readonly route = inject(ActivatedRoute);

  private readonly queryParams = toSignal(this.route.queryParamMap, { requireSync: true });

  protected readonly termino = computed(() => this.queryParams().get('q') ?? '');
}
