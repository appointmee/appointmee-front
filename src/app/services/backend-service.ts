import { Injectable } from '@angular/core';




/*
  Esto comprueba si la api que estamos usando proviene de nuestro backend 
*/  


@Injectable({ providedIn: 'root' })
export class backendService {

  readonly baseUrl = 'http://localhost:8080';

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
