import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { SIN_MANEJO_GLOBAL_DE_ERRORES } from '../http/error-handling-context';
import {
  DisponibilidadDTO,
  TurnoClienteDetalleDTO,
  TurnoCrearDTO,
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
}