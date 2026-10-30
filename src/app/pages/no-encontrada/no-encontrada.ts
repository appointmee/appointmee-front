import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Vista 404 (US-ERR-04).
 * Se muestra cuando la ruta no existe: nunca una pantalla en blanco ni el error
 * del servidor. La info técnica se queda de lado (criterio 3).
 */
@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  templateUrl: './no-encontrada.html',
  styleUrl: './no-encontrada.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFoundPage {
  private readonly router = inject(Router);

  /** Ruta original del 404, sin query params. La barra de direcciones la conserva. */
  protected readonly rutaOriginal = this.router.url.split('?')[0];
}
