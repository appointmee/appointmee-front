import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { SIN_MANEJO_GLOBAL_DE_ERRORES } from '../http/error-handling-context';
import type { AdminEstadisticas, EmpleadorEstadisticas } from '../models/estadisticas';
import { backendService } from './backend-service';

@Injectable({ providedIn: 'root' })
export class estadisticasService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(backendService);

  administrador(desde: string, hasta: string, agrupacion: string): Observable<AdminEstadisticas> {
    return this.http.get<AdminEstadisticas>(`${this.api.baseUrl}/graficos/administrador`, {
      params: new HttpParams().set('desde', desde).set('hasta', hasta).set('agrupacion', agrupacion),
      context: new HttpContext().set(SIN_MANEJO_GLOBAL_DE_ERRORES, true),
    });
  }

  empleador(
    sucursalId: number,
    desde: string,
    hasta: string,
    agrupacion: string,
  ): Observable<EmpleadorEstadisticas> {
    return this.http.get<EmpleadorEstadisticas>(`${this.api.baseUrl}/graficos/empleador`, {
      params: new HttpParams()
        .set('sucursalId', sucursalId)
        .set('desde', desde)
        .set('hasta', hasta)
        .set('agrupacion', agrupacion),
      context: new HttpContext().set(SIN_MANEJO_GLOBAL_DE_ERRORES, true),
    });
  }
}
