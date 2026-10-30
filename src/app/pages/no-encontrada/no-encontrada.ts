import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { RouterLink, Router } from '@angular/router';
import { Reporte404 } from './reporte-404';

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
  private readonly meta = inject(Meta);
  private readonly title = inject(Title);
  private readonly router = inject(Router);
  private readonly reporte404 = inject(Reporte404);

  private readonly titulo = viewChild<ElementRef<HTMLHeadingElement>>('titulo');

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

  constructor() {
    // Registro del 404 para detectar enlaces rotos (criterio 9).
    this.reporte404.registrar(this.rutaOriginal, document.referrer || null);

    // La página 404 no se indexa (criterio 7) y anuncia su título de pestaña.
    this.meta.addTag({ name: 'robots', content: 'noindex, nofollow' });
    this.title.setTitle('No encontramos esta página | AppointMee');

    // El foco va al título para que lectores de pantalla y navegación por
    // teclado sepan con qué página aterrizaron (criterio 8).
    afterNextRender(() => this.titulo()?.nativeElement.focus());
  }

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
