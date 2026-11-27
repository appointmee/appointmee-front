import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { SIN_MANEJO_GLOBAL_DE_ERRORES } from '../http/error-handling-context';
import {
  DisponibilidadDTO,
  EstadoTurno,
  TurnoClienteDetalleDTO,
  TurnoCrearDTO,
  TurnoEmpleadorDetalleDTO,
  TurnoMiniDTO,
  PaginaTurnosDTO,
} from '../models/turno';
import { backendService } from './backend-service';

@Injectable({ providedIn: 'root' })
export class turnoService {
  private http = inject(HttpClient);
  private api = inject(backendService);

  disponibilidad(empleadoId: number, servicioId: number): Observable<DisponibilidadDTO[]> {
    return this.http.get<DisponibilidadDTO[]>(
      `${this.api.baseUrl}/turnos/disponibilidad/empleado/${empleadoId}/servicio/${servicioId}`,
      { context: new HttpContext().set(SIN_MANEJO_GLOBAL_DE_ERRORES, true) },
    );
  }

  registrar(turno: TurnoCrearDTO): Observable<string> {
    return this.http.post(`${this.api.baseUrl}/turnos/registrar`, turno, {
      context: new HttpContext().set(SIN_MANEJO_GLOBAL_DE_ERRORES, true),
      responseType: 'text',
    });
  }

  propios(): Observable<TurnoMiniDTO[]> {
    return this.http.get<TurnoMiniDTO[]>(`${this.api.baseUrl}/turnos/propios`, {
      context: new HttpContext().set(SIN_MANEJO_GLOBAL_DE_ERRORES, true),
    });
  }

  /** GET /turnos/propios/paginado: 10 turnos por página (page 0-based). */
  propiosPaginado(page: number): Observable<PaginaTurnosDTO> {
    return this.http.get<PaginaTurnosDTO>(`${this.api.baseUrl}/turnos/propios/paginado`, {
      params: { page: String(page) },
      context: new HttpContext().set(SIN_MANEJO_GLOBAL_DE_ERRORES, true),
    });
  }

  detallePropio(turnoId: number): Observable<TurnoClienteDetalleDTO> {
    return this.http.get<TurnoClienteDetalleDTO>(
      `${this.api.baseUrl}/turnos/propios/detalles/${turnoId}`,
      { context: new HttpContext().set(SIN_MANEJO_GLOBAL_DE_ERRORES, true) },
    );
  }

  /** GET /turnos/de-sucursal/{sucursalId}. El estado es obligatorio en el backend. */
  turnosDeSucursal(
    sucursalId: number,
    estadoTurno: EstadoTurno,
  ): Observable<TurnoMiniDTO[]> {
    return this.http.get<TurnoMiniDTO[]>(
      `${this.api.baseUrl}/turnos/de-sucursal/${sucursalId}`,
      {
        params: { estadoTurno },
        context: new HttpContext().set(SIN_MANEJO_GLOBAL_DE_ERRORES, true),
      },
    );
  }

  /** Historial paginado de la sucursal: filtro por estado en la base. */
  turnosDeSucursalPaginados(
    sucursalId: number,
    estadoTurno: EstadoTurno,
    page: number,
  ): Observable<PaginaTurnosDTO> {
    return this.http.get<PaginaTurnosDTO>(
      `${this.api.baseUrl}/turnos/de-sucursal/${sucursalId}/paginado`,
      {
        params: { estadoTurno, page: String(page) },
        context: new HttpContext().set(SIN_MANEJO_GLOBAL_DE_ERRORES, true),
      },
    );
  }

  /**
   * GET /turnos/de-sucursal/{sucursalId}/propios.
   * Turnos del empleado autenticado en la sucursal, filtrados por estado.
   */
  turnosAsignadosDeSucursal(
    sucursalId: number,
    estadoTurno: EstadoTurno,
  ): Observable<TurnoMiniDTO[]> {
    return this.http.get<TurnoMiniDTO[]>(
      `${this.api.baseUrl}/turnos/de-sucursal/${sucursalId}/propios`,
      {
        params: { estadoTurno },
        context: new HttpContext().set(SIN_MANEJO_GLOBAL_DE_ERRORES, true),
      },
    );
  }

  /** Turnos asignados paginados: filtro por estado en la base. */
  turnosAsignadosDeSucursalPaginados(
    sucursalId: number,
    estadoTurno: EstadoTurno,
    page: number,
  ): Observable<PaginaTurnosDTO> {
    return this.http.get<PaginaTurnosDTO>(
      `${this.api.baseUrl}/turnos/de-sucursal/${sucursalId}/propios/paginado`,
      {
        params: { estadoTurno, page: String(page) },
        context: new HttpContext().set(SIN_MANEJO_GLOBAL_DE_ERRORES, true),
      },
    );
  }

  /** GET /turnos/de-sucursal/detalles/{turnoId} (TurnoResponseDTO). */
  detalleDeSucursal(turnoId: number): Observable<TurnoEmpleadorDetalleDTO> {
    return this.http.get<TurnoEmpleadorDetalleDTO>(
      `${this.api.baseUrl}/turnos/de-sucursal/detalles/${turnoId}`,
      { context: new HttpContext().set(SIN_MANEJO_GLOBAL_DE_ERRORES, true) },
    );
  }

  /** PATCH /turnos/finalizar/{turnoId}. Disponible para EMPLEADOR y EMPLEADO. */
  finalizarTurno(turnoId: number): Observable<string> {
    return this.http.patch(
      `${this.api.baseUrl}/turnos/finalizar/${turnoId}`,
      null,
      {
        context: new HttpContext().set(SIN_MANEJO_GLOBAL_DE_ERRORES, true),
        responseType: 'text',
      },
    );
  }

  /** DELETE /turnos/cancelar/{turnoId}. Disponible únicamente para EMPLEADOR. */
  cancelarTurno(turnoId: number): Observable<string> {
    return this.http.delete(`${this.api.baseUrl}/turnos/cancelar/${turnoId}`, {
      context: new HttpContext().set(SIN_MANEJO_GLOBAL_DE_ERRORES, true),
      responseType: 'text',
    });
  }
}