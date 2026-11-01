import { Injectable } from '@angular/core';

/**
 * Registro del 404 para observabilidad (criterio 9 de US-ERR-04).
 *
 * Registra los detalles mínimos de la ruta en la consola del navegador.
 * Para observabilidad centralizada hace falta conectar un proveedor frontend.
 */
@Injectable({ providedIn: 'root' })
export class Reporte404 {
  registrar(ruta: string, referrer: string | null): void {
    console.error('[404]', {
      event: 'client_route_not_found',
      ruta: ruta.slice(0, 1024),
      referrer: this.referrerSinQuery(referrer),
      observedAt: new Date().toISOString(),
    });
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
