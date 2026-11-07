import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ReseniaDTO } from '../models/resenia';
import { backendService } from './backend-service';
import { SIN_MANEJO_GLOBAL_DE_ERRORES } from '../http/error-handling-context';

@Injectable({ providedIn: 'root' })
export class reseniaService {
  private readonly api = inject(backendService);
  private readonly http = inject(HttpClient);

  listarPorSucursal(sucursalId: number): Observable<ReseniaDTO[]> {
    return this.http.get<ReseniaDTO[]>(
      `${this.api.baseUrl}/sucursales/${sucursalId}/resenias`,
      { context: new HttpContext().set(SIN_MANEJO_GLOBAL_DE_ERRORES, true) },
    );
  }
}
