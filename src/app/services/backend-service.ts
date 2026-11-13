import { Injectable } from '@angular/core';


@Injectable({ providedIn: 'root' })
export class backendService {

  // El frontend estático usa backend local en desarrollo y HTTPS en producción.
  readonly baseUrl = this.resolveBaseUrl();


  // Comprueba que los tokens solo se envíen a nuestra API.

  esUrlDelBackend(url: string): boolean {
    try {
      const api = new URL(this.baseUrl);
      const destino = new URL(url, globalThis.location?.origin ?? this.baseUrl);

      return destino.origin === api.origin
        && destino.pathname.startsWith(api.pathname);

    } catch {
      return false;
    }
  }

  private resolveBaseUrl(): string {
    const hostname = globalThis.location?.hostname;
    return hostname === 'localhost' || hostname === '127.0.0.1'
      ? 'http://localhost:8080'
      // IMPORTANTE: si cambia la URL pública del backend, actualizar esta URL.
      : 'https://appointmee-back-production.up.railway.app';
  }
}
