import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { EmpleadoDTO } from '../models/empleado';
import { backendService } from './backend-service';
import { SIN_MANEJO_GLOBAL_DE_ERRORES } from '../http/error-handling-context';

@Injectable({ providedIn: 'root' })
export class empleadoService {
  private readonly api = inject(backendService);
  private readonly http = inject(HttpClient);

  listarPorSucursal(sucursalId: number): Observable<EmpleadoDTO[]> {
    return this.http.get<EmpleadoDTO[]>(
      `${this.api.baseUrl}/sucursales/${sucursalId}/elegir-empleado`,
      { context: new HttpContext().set(SIN_MANEJO_GLOBAL_DE_ERRORES, true) },
    );
  }
}
