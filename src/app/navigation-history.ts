import { Injectable, inject } from '@angular/core';
import { NavigationEnd, NavigationStart, Router } from '@angular/router';
import { filter } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class NavigationHistory {
  private readonly router = inject(Router);
  private readonly entries: Array<{ id: number; url: string }> = [];
  private restoredId: number | null = null;
  private replaceCurrent = false;

  constructor() {
    this.router.events.pipe(filter((event) => event instanceof NavigationStart || event instanceof NavigationEnd))
      .subscribe((event) => {
        if (event instanceof NavigationStart) {
          this.restoredId = event.navigationTrigger === 'popstate'
            ? event.restoredState?.['navigationId'] ?? null
            : null;
          this.replaceCurrent = !!this.router.getCurrentNavigation()?.extras.replaceUrl;
          return;
        }

        this.record(event.urlAfterRedirects, Number(history.state?.navigationId ?? 0));
      });
  }

  backTarget(skipUrl?: string): string | null {
    for (let index = this.entries.length - 2; index >= 0; index--) {
      if (!skipUrl || this.entries[index].url !== skipUrl) return this.entries[index].url;
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
      return;
    }

    if (this.replaceCurrent && this.entries.length) {
      this.entries[this.entries.length - 1] = { id, url };
    } else if (this.entries.at(-1)?.url !== url) {
      this.entries.push({ id, url });
    }
    this.replaceCurrent = false;
  }
}
