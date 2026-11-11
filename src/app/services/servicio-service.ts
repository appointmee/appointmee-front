import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { SIN_MANEJO_GLOBAL_DE_ERRORES } from '../http/error-handling-context';
import { ServicioDTO, ServicioPayload } from '../models/servicio';
import { backendService } from './backend-service';

//CRUD SEVICIOS

@Injectable({ providedIn: 'root' })
export class servicioService {
  private readonly api = inject(backendService);
  private readonly http = inject(HttpClient);

  //GET
  listarPorSucursal(idSucursal: number): Observable<ServicioDTO[]> {
    return this.http.get<ServicioDTO[]>(
      `${this.api.baseUrl}/servicios/listar/sucursal/${idSucursal}`,
      { context: this.contextoSinAvisoGlobal() },
    );
  }
// GET
  obtenerPorId(servicioId: number): Observable<ServicioDTO> {
    return this.http.get<ServicioDTO>(`${this.api.baseUrl}/servicios/${servicioId}`);
  }
  //POST
  crear(datos: ServicioPayload): Observable<ServicioDTO> {
    return this.http.post<ServicioDTO>(`${this.api.baseUrl}/servicios`, datos);
  }
//PUT
  actualizar(servicioId: number, datos: ServicioPayload): Observable<ServicioDTO> {
    return this.http.put<ServicioDTO>(`${this.api.baseUrl}/servicios/${servicioId}`, datos);
  }
//DELETE
  /** Elimina un servicio usando la ruta real del backend y deja el error a la pantalla. */
  eliminar(servicioId: number): Observable<string> {
    return this.http.delete(`${this.api.baseUrl}/servicios/eliminar/${servicioId}`, {
      context: this.contextoSinAvisoGlobal(),
      responseType: 'text',
    });
  }

  // esto sirve para hacer que el handler global lo ignore
  private contextoSinAvisoGlobal(): HttpContext {
    return new HttpContext().set(SIN_MANEJO_GLOBAL_DE_ERRORES, true);
  }
}
