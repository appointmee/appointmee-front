import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { SIN_MANEJO_GLOBAL_DE_ERRORES } from '../http/error-handling-context';
import type {
  ContadorNoLeidasDTO,
  FiltroLecturaNotificacion,
  FiltroTipoNotificacion,
  PaginaNotificacionesDTO,
} from '../models/notificacion';
import { backendService } from './backend-service';
import { notificacionesCambiosService } from './notificaciones-cambios-service';

/** Endpoints del centro de notificaciones. Los errores se resuelven inline en la vista. */
@Injectable({ providedIn: 'root' })
export class notificacionService {
  private readonly api = inject(backendService);
  private readonly http = inject(HttpClient);
  private readonly cambios = inject(notificacionesCambiosService);

  /**
   * Lista paginada. Los filtros se combinan en el backend: el tipo y el estado
   * de lectura se envían sólo cuando el usuario eligió uno concreto.
   */
  listar(
    pagina = 0,
    tamano = 20,
    tipo: FiltroTipoNotificacion = 'TODOS',
    lectura: FiltroLecturaNotificacion = 'TODAS',
  ): Observable<PaginaNotificacionesDTO> {
    const params: Record<string, string> = {
      pagina: String(pagina),
      tamano: String(tamano),
    };
    if (tipo !== 'TODOS') {
      params['tipo'] = tipo;
    }
    if (lectura !== 'TODAS') {
      params['leida'] = lectura === 'LEIDAS' ? 'true' : 'false';
    }

    return this.http.get<PaginaNotificacionesDTO>(
      `${this.api.baseUrl}/notificaciones`,
      {
        params,
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

  /** Marca una notificación propia como leída y devuelve el contador actualizado. */
  marcarLeida(id: number): Observable<ContadorNoLeidasDTO> {
    return this.http.patch<ContadorNoLeidasDTO>(
      `${this.api.baseUrl}/notificaciones/${id}/leido`,
      {},
      { context: this.contextoSinAvisoGlobal() },
    ).pipe(tap(() => this.cambios.notificarCambio()));
  }

  /** Marca todas como leídas, respetando el filtro de tipo activo. */
  marcarTodasLeidas(tipo: FiltroTipoNotificacion = 'TODOS'): Observable<ContadorNoLeidasDTO> {
    const params = tipo !== 'TODOS' ? { tipo } : undefined;
    return this.http.patch<ContadorNoLeidasDTO>(
      `${this.api.baseUrl}/notificaciones/leer-todas`,
      {},
      { params, context: this.contextoSinAvisoGlobal() },
    ).pipe(tap(() => this.cambios.notificarCambio()));
  }

  private contextoSinAvisoGlobal(): HttpContext {
    return new HttpContext().set(SIN_MANEJO_GLOBAL_DE_ERRORES, true);
  }
}
