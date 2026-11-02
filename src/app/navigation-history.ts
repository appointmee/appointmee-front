import { Injectable, inject } from '@angular/core';
import { NavigationEnd, NavigationStart, Router } from '@angular/router';
import { filter } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class NavigationHistory {
  private static readonly STORAGE_KEY = 'appointmee.navigation-history';
  private readonly router = inject(Router);
  private readonly entries: Array<{ id: number; url: string }> = this.restore();
  private restoredId: number | null = null;
  private replaceCurrent = false;

  constructor() {
    this.router.events.pipe(filter((event) => event instanceof NavigationStart || event instanceof NavigationEnd))
      .subscribe((event) => {
        if (event instanceof NavigationStart) {
          this.restoredId = event.navigationTrigger === 'popstate'
            ? event.restoredState?.['navigationId'] ?? null
            : null;
          // Al iniciar después de escribir una URL, la última entrada guardada
          // pertenece a la pantalla anterior y no debe reemplazarse por el 404.
          this.replaceCurrent = this.router.navigated
            && !!this.router.getCurrentNavigation()?.extras.replaceUrl;
          return;
        }

        this.record(event.urlAfterRedirects, Number(history.state?.navigationId ?? 0));
      });
  }

  backTarget(currentUrl: string): string | null {
    for (let index = this.entries.length - 1; index >= 0; index--) {
      const candidate = this.entries[index].url;

      if (candidate !== currentUrl) {
        return candidate;
      }
    }

    return null;
  }

  private record(url: string, id: number): void {
    if (this.restoredId !== null) {
      const restoredIndex = this.entries.findIndex((entry) => entry.id === this.restoredId);
      if (restoredIndex >= 0) {
        this.entries.splice(restoredIndex + 1);
        this.entries[restoredIndex] = { id, url };
      } else {
        this.entries.push({ id, url });
      }
      this.restoredId = null;
      this.persist();
      return;
    }

    if (this.replaceCurrent && this.entries.length) {
      this.entries[this.entries.length - 1] = { id, url };
    } else if (this.entries.at(-1)?.url !== url) {
      this.entries.push({ id, url });
    }
    this.replaceCurrent = false;
    this.persist();
  }

  private restore(): Array<{ id: number; url: string }> {
    try {
      const value: unknown = JSON.parse(sessionStorage.getItem(NavigationHistory.STORAGE_KEY) ?? '[]');
      if (!Array.isArray(value)) return [];
      return value.filter((entry): entry is { id: number; url: string } =>
        !!entry && typeof entry.id === 'number' && typeof entry.url === 'string' && entry.url.startsWith('/'));
    } catch {
      return [];
    }
  }

  private persist(): void {
    try {
      // El historial es solo navegación reciente de esta pestaña.
      sessionStorage.setItem(NavigationHistory.STORAGE_KEY, JSON.stringify(this.entries.slice(-50)));
    } catch {
      // La navegación sigue funcionando si el navegador bloquea el storage.
    }
  }
}
