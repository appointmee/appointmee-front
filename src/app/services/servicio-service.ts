import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { SIN_MANEJO_GLOBAL_DE_ERRORES } from '../http/error-handling-context';
import { ServicioDTO } from '../models/servicio';
import { backendService } from './backend-service';

@Injectable({ providedIn: 'root' })
export class servicioService {
  private readonly api = inject(backendService);
  private readonly http = inject(HttpClient);

  /**
   * Listado de servicios de una sucursal. El error se muestra dentro de la
   * pantalla, por eso se le pide al interceptor global que no navegue ni
   * muestre el aviso general.
   */
  listarPorSucursal(idSucursal: number): Observable<ServicioDTO[]> {
    return this.http.get<ServicioDTO[]>(
      `${this.api.baseUrl}/servicios/listar/sucursal/${idSucursal}`,
      { context: this.contextoSinAvisoGlobal() },
    );
  }

  private contextoSinAvisoGlobal(): HttpContext {
    return new HttpContext().set(SIN_MANEJO_GLOBAL_DE_ERRORES, true);
  }
}
