import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { SIN_MANEJO_GLOBAL_DE_ERRORES } from '../http/error-handling-context';
import { DisponibilidadDTO, TurnoCrearPayload, TurnoCreadoDTO } from '../models/turno';
import { backendService } from './backend-service';

@Injectable({ providedIn: 'root' })
export class turnoService {
  private readonly api = inject(backendService);
  private readonly http = inject(HttpClient);

  disponibilidad(empleadoId: number, servicioId: number): Observable<DisponibilidadDTO[]> {
    return this.http.get<DisponibilidadDTO[]>(
      `${this.api.baseUrl}/turnos/disponibilidad/empleado/${empleadoId}/servicio/${servicioId}`,
      { context: new HttpContext().set(SIN_MANEJO_GLOBAL_DE_ERRORES, true) },
    );
  }

  registrar(datos: TurnoCrearPayload): Observable<TurnoCreadoDTO> {
    return this.http.post<TurnoCreadoDTO>(`${this.api.baseUrl}/turnos/registrar`, datos, {
      context: new HttpContext().set(SIN_MANEJO_GLOBAL_DE_ERRORES, true),
    });
  }
}
