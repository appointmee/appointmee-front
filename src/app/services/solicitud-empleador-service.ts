import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { SIN_MANEJO_GLOBAL_DE_ERRORES } from '../http/error-handling-context';
import {
  EstadoSolicitudEmpleador,
  PaginaSolicitudesEmpleadorDTO,
  SolicitudEmpleadorCrearDTO,
  SolicitudEmpleadorDetalleDTO,
  SolicitudEmpleadorMiniDTO,
  TAMANO_PAGINA_SOLICITUDES,
} from '../models/solicitud-empleador';
import { backendService } from './backend-service';

/**
 * Cliente de los endpoints existentes de solicitudes de empleador.
 * Todas las lecturas y acciones resuelven sus errores inline en las pantallas.
 */
@Injectable({ providedIn: 'root' })
export class solicitudEmpleadorService {
  private readonly api = inject(backendService);
  private readonly http = inject(HttpClient);

  /** Envía el motivo y las ubicaciones elegidas en Google Places. */
  solicitar(datos: SolicitudEmpleadorCrearDTO): Observable<string> {
    return this.http.post(
      `${this.api.baseUrl}/solicitudes-empleador/solicitar`,
      datos,
      { context: this.contextoSinAvisoGlobal(), responseType: 'text' },
    );
  }

  listarPropias(): Observable<SolicitudEmpleadorMiniDTO[]> {
    return this.http.get<SolicitudEmpleadorMiniDTO[]>(
      `${this.api.baseUrl}/solicitudes-empleador/propias`,
      { context: this.contextoSinAvisoGlobal() },
    );
  }

  /**
   * Listado administrativo real del backend: el filtro y el desplazamiento se
   * resuelven allí. `page` comienza en 0 y el tamaño es siempre 10.
   */
  listarAdministrativas(
    estado: EstadoSolicitudEmpleador,
    page: number,
  ): Observable<PaginaSolicitudesEmpleadorDTO> {
    const params = new HttpParams()
      .set('estado', estado)
      .set('page', String(page))
      .set('size', String(TAMANO_PAGINA_SOLICITUDES));

    return this.http.get<PaginaSolicitudesEmpleadorDTO>(
      `${this.api.baseUrl}/solicitudes-empleador/listar`,
      { params, context: this.contextoSinAvisoGlobal() },
    );
  }

  verDetalle(id: number): Observable<SolicitudEmpleadorDetalleDTO> {
    return this.http.get<SolicitudEmpleadorDetalleDTO>(
      `${this.api.baseUrl}/solicitudes-empleador/${id}/detalles`,
      { context: this.contextoSinAvisoGlobal() },
    );
  }

  aprobar(id: number): Observable<string> {
    return this.http.patch(
      `${this.api.baseUrl}/solicitudes-empleador/${id}/aprobar`,
      {},
      { context: this.contextoSinAvisoGlobal(), responseType: 'text' },
    );
  }

  rechazar(id: number): Observable<string> {
    return this.http.patch(
      `${this.api.baseUrl}/solicitudes-empleador/${id}/rechazar`,
      {},
      { context: this.contextoSinAvisoGlobal(), responseType: 'text' },
    );
  }

  private contextoSinAvisoGlobal(): HttpContext {
    return new HttpContext().set(SIN_MANEJO_GLOBAL_DE_ERRORES, true);
  }
}
