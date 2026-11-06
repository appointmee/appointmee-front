import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ReseniaDTO } from '../models/resenia';
import { backendService } from './backend-service';

@Injectable({ providedIn: 'root' })
export class reseniaService {
  private readonly api = inject(backendService);
  private readonly http = inject(HttpClient);

  listarPorSucursal(sucursalId: number): Observable<ReseniaDTO[]> {
    return this.http.get<ReseniaDTO[]>(
      `${this.api.baseUrl}/sucursales/${sucursalId}/resenias`,
    );
  }
}
