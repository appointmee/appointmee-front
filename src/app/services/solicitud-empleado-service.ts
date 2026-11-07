import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { SIN_MANEJO_GLOBAL_DE_ERRORES } from '../http/error-handling-context';
import {
  SolicitudEmpleadoDetalleDTO,
  SolicitudEmpleadoMiniPropiaDTO,
  SolicitudEmpleadoMiniSucursalDTO,
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

  listarRecibidas(): Observable<SolicitudEmpleadoMiniPropiaDTO[]> {
    return this.http.get<SolicitudEmpleadoMiniPropiaDTO[]>(
      `${this.api.baseUrl}/solicitudes-empleado/recibidas`,
      { context: this.contextoSinAvisoGlobal() },
    );
  }

  listarEnviadas(sucursalId: number): Observable<SolicitudEmpleadoMiniSucursalDTO[]> {
    return this.http.get<SolicitudEmpleadoMiniSucursalDTO[]>(
      `${this.api.baseUrl}/solicitudes-empleado/enviadas/sucursal/${sucursalId}`,
      { context: this.contextoSinAvisoGlobal() },
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
