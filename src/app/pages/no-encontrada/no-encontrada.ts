import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink, Router } from '@angular/router';

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

  protected readonly terminoBusqueda = signal('');

  protected actualizarTermino(event: Event): void {
    this.terminoBusqueda.set((event.target as HTMLInputElement).value);
  }

  /** Busca con lo que escribió el usuario: navega a la Home con la query `busqueda`. */
  protected buscar(event: Event): void {
    event.preventDefault();

    const termino = this.terminoBusqueda().trim();

    if (!termino) {
      void this.router.navigate(['/']);
      return;
    }

    void this.router.navigate(['/'], { queryParams: { busqueda: termino } });
  }
}
