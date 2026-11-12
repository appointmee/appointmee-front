import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { SIN_MANEJO_GLOBAL_DE_ERRORES } from '../http/error-handling-context';
import { ServicioDTO, ServicioModificarPayload, ServicioPayload } from '../models/servicio';
import { backendService } from './backend-service';

/** Acceso HTTP al catálogo de servicios y a sus operaciones de edición. */

@Injectable({ providedIn: 'root' })
export class servicioService {
  private readonly api = inject(backendService);
  private readonly http = inject(HttpClient);

  /** Lista los servicios visibles para la sucursal, con errores manejados por la pantalla. */
  listarPorSucursal(idSucursal: number): Observable<ServicioDTO[]> {
    return this.http.get<ServicioDTO[]>(
      `${this.api.baseUrl}/servicios/listar/sucursal/${idSucursal}`,
      { context: this.contextoSinAvisoGlobal() },
    );
  }
  /**
   * Obtiene un servicio para una vista de detalle o edición.
   * `silenciarErroresGlobales` permite que la pantalla muestre el error
   * inline sin duplicar el aviso global del interceptor.
   */
  obtenerPorId(servicioId: number, silenciarErroresGlobales = false): Observable<ServicioDTO> {
    const url = `${this.api.baseUrl}/servicios/${servicioId}`;
    if (!silenciarErroresGlobales) {
      return this.http.get<ServicioDTO>(url);
    }
    return this.http.get<ServicioDTO>(url, { context: this.contextoSinAvisoGlobal() });
  }
  /** Envía al backend los datos validados de un nuevo servicio. */
  crear(datos: ServicioPayload): Observable<string> {
    return this.http.post(
      `${this.api.baseUrl}/servicios/crear`,
      datos,
      {
        context: new HttpContext().set(SIN_MANEJO_GLOBAL_DE_ERRORES, true),
        responseType: 'text',
      },
    );
  }
  /**
   * Actualiza los datos editables de un servicio existente.
   * El backend solo aplica los campos recibidos: los que no llegan conservan
   * su valor actual (incluida la foto, si no se envía `fotoUrl`).
   */
  actualizar(servicioId: number, datos: ServicioModificarPayload): Observable<string> {
    return this.http.patch(
      `${this.api.baseUrl}/servicios/modificar/${servicioId}`,
      datos,
      {
        context: new HttpContext().set(SIN_MANEJO_GLOBAL_DE_ERRORES, true),
        responseType: 'text',
      },
    );
  }
  /**
   * Solicita la eliminación del servicio; el backend define su persistencia.
   *
   * El endpoint responde con un texto plano ("Se elimino el servicio
   * correctamente"), por eso se pide `text` y no JSON: con el tipo por defecto
   * la respuesta no se podría interpretar.
   *
   * Los errores los maneja la pantalla, así que se evita el aviso global del
   * interceptor para que el mensaje aparezca inline, sin cambiar de ruta.
   */
  eliminar(servicioId: number): Observable<void> {
    return this.http
      .delete(`${this.api.baseUrl}/servicios/eliminar/${servicioId}`, {
        context: this.contextoSinAvisoGlobal(),
        responseType: 'text',
      })
      .pipe(map(() => undefined));
  }

  /** Deja que la pantalla presente el error inline sin duplicar el aviso global. */
  private contextoSinAvisoGlobal(): HttpContext {
    return new HttpContext().set(SIN_MANEJO_GLOBAL_DE_ERRORES, true);
  }
}
