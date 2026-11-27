import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
  PaginaReseniasDTO,
  ReseniaDTO,
  ReseniaPayload,
  VistaPreviaReseniasDTO,
} from '../models/resenia';
import { backendService } from './backend-service';
import { SIN_MANEJO_GLOBAL_DE_ERRORES } from '../http/error-handling-context';

// CRUD RESENIA

@Injectable({ providedIn: 'root' })
export class reseniaService {
  private readonly api = inject(backendService);
  private readonly http = inject(HttpClient);

  //GET: últimas 5 reseñas para el detalle de la sucursal.
  listarPorSucursal(sucursalId: number): Observable<VistaPreviaReseniasDTO> {
    return this.http.get<VistaPreviaReseniasDTO>(
      `${this.api.baseUrl}/sucursales/${sucursalId}/resenias`,
      { context: new HttpContext().set(SIN_MANEJO_GLOBAL_DE_ERRORES, true) },
    );
  }

  /** Historial completo: 10 reseñas por página (page 0-based). */
  listarPaginadoPorSucursal(
    sucursalId: number,
    page: number,
  ): Observable<PaginaReseniasDTO> {
    return this.http.get<PaginaReseniasDTO>(
      `${this.api.baseUrl}/sucursales/${sucursalId}/resenias/paginado`,
      {
        params: new HttpParams().set('page', String(page)),
        context: new HttpContext().set(SIN_MANEJO_GLOBAL_DE_ERRORES, true),
      },
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

  /**
   * POST /turnos/{turnoId}/resenia (ReseniaCrearDTO del backend).
   * Es el endpoint existente para publicar la reseña de un turno propio.
   */
  crearParaTurno(turnoId: number, datos: ReseniaPayload): Observable<string> {
    return this.http.post(`${this.api.baseUrl}/turnos/${turnoId}/resenia`, datos, {
      context: new HttpContext().set(SIN_MANEJO_GLOBAL_DE_ERRORES, true),
      responseType: 'text',
    });
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
