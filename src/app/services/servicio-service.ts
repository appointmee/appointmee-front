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
    return this.http.post<ServicioDTO>(`${this.api.baseUrl}/servicios/crear`, datos);
  }
//PUT
  actualizar(servicioId: number, datos: ServicioPayload): Observable<ServicioDTO> {
    return this.http.patch<ServicioDTO>(`${this.api.baseUrl}/servicios/modificar/${servicioId}`, datos);
  }
//DELETE
  eliminar(servicioId: number): Observable<void> {
    return this.http.delete<void>(`${this.api.baseUrl}/servicios/${servicioId}`);
  }

  // esto sirve para hacer que el handler global lo ignore
  private contextoSinAvisoGlobal(): HttpContext {
    return new HttpContext().set(SIN_MANEJO_GLOBAL_DE_ERRORES, true);
  }
}
