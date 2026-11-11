import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ReseniaDTO, ReseniaPayload } from '../models/resenia';
import { backendService } from './backend-service';
import { SIN_MANEJO_GLOBAL_DE_ERRORES } from '../http/error-handling-context';

// CRUD RESENIA

@Injectable({ providedIn: 'root' })
export class reseniaService {
  private readonly api = inject(backendService);
  private readonly http = inject(HttpClient);

  //GET
  listarPorSucursal(sucursalId: number): Observable<ReseniaDTO[]> {
    return this.http.get<ReseniaDTO[]>(
      `${this.api.baseUrl}/sucursales/${sucursalId}/resenias`,
      { context: new HttpContext().set(SIN_MANEJO_GLOBAL_DE_ERRORES, true) },
    );
  }

  //GET
  obtenerPorId(sucursalId: number, reseniaId: number): Observable<ReseniaDTO> {
    return this.http.get<ReseniaDTO>(
      `${this.api.baseUrl}/sucursales/${sucursalId}/resenias/${reseniaId}`,
    );
  }

  //POST
  crear(sucursalId: number, datos: ReseniaPayload): Observable<ReseniaDTO> {
    return this.http.post<ReseniaDTO>(
      `${this.api.baseUrl}/sucursales/${sucursalId}/resenias`,
      datos,
      { context: new HttpContext().set(SIN_MANEJO_GLOBAL_DE_ERRORES, true) },
    );
  }
//PUT
  actualizar(sucursalId: number, reseniaId: number, datos: ReseniaPayload): Observable<ReseniaDTO> {
    return this.http.put<ReseniaDTO>(
      `${this.api.baseUrl}/sucursales/${sucursalId}/resenias/${reseniaId}`,
      datos,
    );
  }
//DELETE
  eliminar(sucursalId: number, reseniaId: number): Observable<void> {
    return this.http.delete<void>(
      `${this.api.baseUrl}/sucursales/${sucursalId}/resenias/${reseniaId}`,
    );
  }
}
