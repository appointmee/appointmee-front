import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { EmpleadoDTO } from '../models/empleado';
import { backendService } from './backend-service';

@Injectable({ providedIn: 'root' })
export class empleadoService {
  private readonly api = inject(backendService);
  private readonly http = inject(HttpClient);

  listarPorSucursal(sucursalId: number): Observable<EmpleadoDTO[]> {
    return this.http.get<EmpleadoDTO[]>(
      `${this.api.baseUrl}/sucursales/${sucursalId}/elegir-empleado`,
    );
  }
}
