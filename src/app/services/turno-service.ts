import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { SIN_MANEJO_GLOBAL_DE_ERRORES } from '../http/error-handling-context';
import { DisponibilidadDTO } from '../models/turno';
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
}
