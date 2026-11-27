import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { SIN_MANEJO_GLOBAL_DE_ERRORES } from '../http/error-handling-context';
import {
  SolicitudEmpleadoDetalleDTO,
  SolicitudEmpleadoMiniPropiaDTO,
  PaginaSolicitudesEmpleadoDTO,
  PaginaSolicitudesEmpleadoSucursalDTO,
  VistaPreviaSolicitudesEmpleadoDTO,
  VistaPreviaSolicitudesEmpleadoSucursalDTO,
} from '../models/solicitud-empleado';
import { backendService } from './backend-service';

/**
 * Cliente de los endpoints existentes de solicitudes de empleo.
 * Las lecturas y acciones resuelven sus errores inline en las pantallas.
 */
@Injectable({ providedIn: 'root' })
export class solicitudEmpleadoService {
  private readonly api = inject(backendService);
  private readonly http = inject(HttpClient);

  /** Vista inicial: últimas 5 solicitudes y flag para mostrar «Ver todas». */
  listarRecibidas(): Observable<VistaPreviaSolicitudesEmpleadoDTO> {
    return this.http.get<VistaPreviaSolicitudesEmpleadoDTO>(
      `${this.api.baseUrl}/solicitudes-empleado/recibidas`,
      { context: this.contextoSinAvisoGlobal() },
    );
  }

  /** Historial completo: 10 solicitudes por página (page 0-based). */
  listarRecibidasPaginado(page: number): Observable<PaginaSolicitudesEmpleadoDTO> {
    return this.http.get<PaginaSolicitudesEmpleadoDTO>(
      `${this.api.baseUrl}/solicitudes-empleado/recibidas/paginado`,
      {
        params: new HttpParams().set('page', String(page)),
        context: this.contextoSinAvisoGlobal(),
      },
    );
  }

  /** Vista inicial: 3 invitaciones y flag para mostrar «Ver más» (0-based page). */
  listarEnviadas(
    sucursalId: number,
  ): Observable<VistaPreviaSolicitudesEmpleadoSucursalDTO> {
    return this.http.get<VistaPreviaSolicitudesEmpleadoSucursalDTO>(
      `${this.api.baseUrl}/solicitudes-empleado/enviadas/sucursal/${sucursalId}`,
      { context: this.contextoSinAvisoGlobal() },
    );
  }

  /** Historial completo: 10 invitaciones por página (page 0-based). */
  listarEnviadasPaginadas(
    sucursalId: number,
    page: number,
  ): Observable<PaginaSolicitudesEmpleadoSucursalDTO> {
    return this.http.get<PaginaSolicitudesEmpleadoSucursalDTO>(
      `${this.api.baseUrl}/solicitudes-empleado/enviadas/sucursal/${sucursalId}/paginado`,
      {
        params: new HttpParams().set('page', String(page)),
        context: this.contextoSinAvisoGlobal(),
      },
    );
  }

  verDetalle(id: number): Observable<SolicitudEmpleadoDetalleDTO> {
    return this.http.get<SolicitudEmpleadoDetalleDTO>(
      `${this.api.baseUrl}/solicitudes-empleado/${id}/detalles`,
      { context: this.contextoSinAvisoGlobal() },
    );
  }

  aprobar(id: number): Observable<string> {
    return this.http.patch(
      `${this.api.baseUrl}/solicitudes-empleado/${id}/aprobar`,
      {},
      { context: this.contextoSinAvisoGlobal(), responseType: 'text' },
    );
  }

  rechazar(id: number): Observable<string> {
    return this.http.patch(
      `${this.api.baseUrl}/solicitudes-empleado/${id}/rechazar`,
      {},
      { context: this.contextoSinAvisoGlobal(), responseType: 'text' },
    );
  }

  private contextoSinAvisoGlobal(): HttpContext {
    return new HttpContext().set(SIN_MANEJO_GLOBAL_DE_ERRORES, true);
  }
}
