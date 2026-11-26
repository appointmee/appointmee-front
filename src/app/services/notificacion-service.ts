import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { SIN_MANEJO_GLOBAL_DE_ERRORES } from '../http/error-handling-context';
import type {
  ContadorNoLeidasDTO,
  PaginaNotificacionesDTO,
} from '../models/notificacion';
import { backendService } from './backend-service';

/** Endpoints de consulta del centro de notificaciones. Los errores se resuelven inline en la vista. */
@Injectable({ providedIn: 'root' })
export class notificacionService {
  private readonly api = inject(backendService);
  private readonly http = inject(HttpClient);

  listar(pagina = 0, tamano = 20): Observable<PaginaNotificacionesDTO> {
    return this.http.get<PaginaNotificacionesDTO>(
      `${this.api.baseUrl}/notificaciones`,
      {
        params: { pagina: String(pagina), tamano: String(tamano) },
        context: this.contextoSinAvisoGlobal(),
      },
    );
  }

  contarNoLeidas(): Observable<ContadorNoLeidasDTO> {
    return this.http.get<ContadorNoLeidasDTO>(
      `${this.api.baseUrl}/notificaciones/no-leidas`,
      { context: this.contextoSinAvisoGlobal() },
    );
  }

  private contextoSinAvisoGlobal(): HttpContext {
    return new HttpContext().set(SIN_MANEJO_GLOBAL_DE_ERRORES, true);
  }
}
