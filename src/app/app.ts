import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, NavigationError, Router, RouterLink, RouterOutlet } from '@angular/router';
import { Navbar } from './components/navbar/navbar';
import { Footer } from './components/footer/footer';
import { ApiErrors } from './http/api-errors';
import { NavigationHistory } from './navigation-history';
import { reservaContextoService } from './services/reserva-contexto-service';

@Component({
  imports: [RouterOutlet, RouterLink, Navbar, Footer],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly apiErrors = inject(ApiErrors);
  private readonly navigationHistory = inject(NavigationHistory);
  private readonly reservaContexto = inject(reservaContextoService);
  private readonly router = inject(Router);

  protected readonly rutaFallida = signal<string | null>(null);
  protected readonly reintentando = signal(false);

  constructor() {
    this.router.events.pipe(takeUntilDestroyed()).subscribe(event => {
      if (event instanceof NavigationError) {
        this.rutaFallida.set(event.url);
        this.reintentando.set(false);
      } else if (event instanceof NavigationEnd) {
        this.rutaFallida.set(null);
        this.reintentando.set(false);
        if (!this.esRutaDeReserva(event.urlAfterRedirects)) {
          this.reservaContexto.limpiar();
        }
      }
    });
  }

  private esRutaDeReserva(url: string): boolean {
    const [path, query = ''] = url.split('?');
    if (/^\/sucursal\/\d+(?:\/servicios(?:\/\d+(?:\/(?:empleados|turnos))?\/?)?|\/profesionales)?\/?$/.test(path ?? '')) return true;
    if (path !== '/login') return false;
    const destino = new URLSearchParams(query).get('returnTo') ?? '';
    return /^\/sucursal\/\d+\/servicios(?:\?|$)/.test(destino);
  }

  protected reintentarNavegacion(): void {
    const ruta = this.rutaFallida();
    if (!ruta || this.reintentando()) return;

    this.reintentando.set(true);
    void this.router.navigateByUrl(ruta)
      .catch(() => undefined)
      .finally(() => this.reintentando.set(false));
  }
}
