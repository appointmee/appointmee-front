import { Injectable } from '@angular/core';


@Injectable({ providedIn: 'root' })
export class backendService {

  // Dirección compartida por los servicios del backend.

  readonly baseUrl = 'http://localhost:8080';


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
}
