import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Meta, Title } from '@angular/platform-browser';
import { NavigationEnd, RouterLink, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
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
  private readonly destroyRef = inject(DestroyRef);
  protected readonly canGoBack = this.hasInternalHistory();
  protected readonly busqueda = signal('');

  private readonly titulo = viewChild<ElementRef<HTMLHeadingElement>>('titulo');

  /** Ruta original del 404, sin query params. La barra de direcciones la conserva. */
  protected readonly rutaOriginal = signal(this.router.url.split('?')[0]);

  /**
   * Si la ruta parece un ID de sucursal (ej: `/123`, `/sucursal/123`),
   * se ofrece abrir la ruta de la sucursal (criterio 5). No requiere sesión.
   */
  protected readonly idSucursal = computed(() => this.detectarIdSucursal(this.rutaOriginal()));

  protected goBack(): void {
    if (this.canGoBack) history.back();
    else void this.router.navigateByUrl('/');
  }

  protected buscarSucursal(event: Event): void {
    event.preventDefault();
    const termino = this.busqueda().trim();
    if (!termino) return;
    void this.router.navigate(['/sucursales'], { queryParams: { busqueda: termino } });
  }

  private hasInternalHistory(): boolean {
    const previous = this.router.getCurrentNavigation()?.previousNavigation;
    return !!previous && this.router.serializeUrl(previous.finalUrl ?? previous.extractedUrl).startsWith('/');
  }

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
    this.reporte404.registrar(this.rutaOriginal(), document.referrer || null);
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((event) => {
        const ruta = event.urlAfterRedirects.split('?')[0];
        if (ruta === this.rutaOriginal()) return;
        this.rutaOriginal.set(ruta);
        this.reporte404.registrar(ruta, document.referrer || null);
      });

    // La página 404 no se indexa (criterio 7) y anuncia su título de pestaña.
    this.meta.addTag({ name: 'robots', content: 'noindex, nofollow' });
    this.title.setTitle('No encontramos esta página | AppointMee');
    this.destroyRef.onDestroy(() => this.meta.removeTag('name="robots"'));

    // El foco va al título para que lectores de pantalla y navegación por
    // teclado sepan con qué página aterrizaron (criterio 8).
    afterNextRender(() => this.titulo()?.nativeElement.focus());
  }
}
