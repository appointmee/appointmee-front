import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { SIN_MANEJO_GLOBAL_DE_ERRORES } from '../http/error-handling-context';
import { ServicioDTO, ServicioPayload } from '../models/servicio';
import { backendService } from './backend-service';

/** Acceso HTTP al catálogo de servicios y a sus operaciones de edición. */

@Injectable({ providedIn: 'root' })
export class servicioService {
  private readonly api = inject(backendService);
  private readonly http = inject(HttpClient);

  /** Lista los servicios visibles para la sucursal, con errores manejados por la pantalla. */
  listarPorSucursal(idSucursal: number): Observable<ServicioDTO[]> {
    return this.http.get<ServicioDTO[]>(
      `${this.api.baseUrl}/servicios/listar/sucursal/${idSucursal}`,
      { context: this.contextoSinAvisoGlobal() },
    );
  }
  /** Obtiene un servicio para una vista de detalle o edición. */
  obtenerPorId(servicioId: number): Observable<ServicioDTO> {
    return this.http.get<ServicioDTO>(`${this.api.baseUrl}/servicios/${servicioId}`);
  }
  /** Envía al backend los datos validados de un nuevo servicio. */
  crear(datos: ServicioPayload): Observable<ServicioDTO> {
    return this.http.post<ServicioDTO>(`${this.api.baseUrl}/servicios`, datos);
  }
  /** Actualiza los datos editables de un servicio existente. */
  actualizar(servicioId: number, datos: ServicioPayload): Observable<ServicioDTO> {
    return this.http.put<ServicioDTO>(`${this.api.baseUrl}/servicios/${servicioId}`, datos);
  }
  /** Solicita la eliminación del servicio; el backend define su persistencia. */
  eliminar(servicioId: number): Observable<void> {
    return this.http.delete<void>(`${this.api.baseUrl}/servicios/${servicioId}`);
  }

  /** Deja que la pantalla presente el error inline sin duplicar el aviso global. */
  private contextoSinAvisoGlobal(): HttpContext {
    return new HttpContext().set(SIN_MANEJO_GLOBAL_DE_ERRORES, true);
  }
}
