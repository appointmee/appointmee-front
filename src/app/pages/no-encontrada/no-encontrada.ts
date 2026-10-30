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

  /**
   * Si la ruta parece un ID de sucursal (ej: `/123`, `/sucursal/123`),
   * se ofrece la búsqueda de sucursales (criterio 5). No requiere sesión.
   */
  protected readonly idSucursal = this.detectarIdSucursal(this.rutaOriginal);

  protected readonly terminoBusqueda = signal('');

  private detectarIdSucursal(ruta: string): string | null {
    const partes = ruta.split('/').filter(Boolean);

    // Hay sucursal en juego si hay un segmento puramente numérico,
    // sea directo (/123) o dentro de una ruta de sucursales (/sucursal/123).
    const esSucursalDirecta = partes.length > 0 && /^\d+$/.test(partes[0]);
    const esRutaDeSucursales = partes[0]?.toLowerCase().includes('sucursal') ?? false;

    if (esRutaDeSucursales) {
      const id = partes.find((parte) => /^\d+$/.test(parte));
      return id ?? null;
    }

    return esSucursalDirecta ? partes[0] : null;
  }

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
