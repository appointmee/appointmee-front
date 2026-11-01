import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, timeout } from 'rxjs/operators';
import { of } from 'rxjs';
import { API_URL } from '../../auth/auth';

/**
 * Registro del 404 para observabilidad (criterio 9 de US-ERR-04).
 *
 * Envía los detalles mínimos al backend, que los registra como evento JSON
 * estructurado en los logs de la aplicación.
 */
@Injectable({ providedIn: 'root' })
export class Reporte404 {
  private readonly http = inject(HttpClient);

  registrar(ruta: string, referrer: string | null): void {
    const apiUrl = this.apiUrl();
    if (!apiUrl) return;

    this.http
      .post(`${apiUrl}/observabilidad/404`, {
        path: ruta.slice(0, 1024),
        referrer: this.referrerSinQuery(referrer),
      })
      .pipe(timeout(3000), catchError(() => of(null)))
      .subscribe();
  }

  private apiUrl(): string | null {
    if (typeof window === 'undefined') return null;
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') return API_URL;
    return 'https://appointmee-vcs2.onrender.com';
  }

  private referrerSinQuery(referrer: string | null): string | null {
    if (!referrer) return null;

    try {
      const url = new URL(referrer);
      return `${url.origin}${url.pathname}`.slice(0, 2048);
    } catch {
      return null;
    }
  }
}
