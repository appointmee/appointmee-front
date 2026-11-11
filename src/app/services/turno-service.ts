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

  /** GET /turnos/de-sucursal/detalles/{turnoId} (TurnoResponseDTO). */
  detalleDeSucursal(turnoId: number): Observable<TurnoEmpleadorDetalleDTO> {
    return this.http.get<TurnoEmpleadorDetalleDTO>(
      `${this.api.baseUrl}/turnos/de-sucursal/detalles/${turnoId}`,
      { context: new HttpContext().set(SIN_MANEJO_GLOBAL_DE_ERRORES, true) },
    );
  }
}