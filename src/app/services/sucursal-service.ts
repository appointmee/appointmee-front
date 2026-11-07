import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { backendService } from './backend-service';
import { SIN_MANEJO_GLOBAL_DE_ERRORES } from '../http/error-handling-context';
import { SucursalDetalleDTO, SucursalMiniDTO } from '../models/sucursal';

/**
 * Devuelve un HttpContext que silencia el manejo global de errores para que la
 * pantalla consumidora presente su propio estado de error inline (sin navegar a
 * /error ni mostrar el aviso general).
 */
function contextoSilenciado(activado: boolean): HttpContext {
  return activado ? new HttpContext().set(SIN_MANEJO_GLOBAL_DE_ERRORES, true) : new HttpContext();
}

@Injectable({ providedIn: 'root' })
export class sucursalService {
  private readonly api = inject(backendService);

  private readonly http = inject(HttpClient);

  listar(silenciarErroresGlobales = false): Observable<SucursalMiniDTO[]> {
    return this.http.get<SucursalMiniDTO[]>(`${this.api.baseUrl}/sucursales/listar`, {
      context: contextoSilenciado(silenciarErroresGlobales),
    });
  }

  filtrar(
    categoria?: string | null,
    nombre?: string | null,
    silenciarErroresGlobales = false,
  ): Observable<SucursalMiniDTO[]> {
    let params = new HttpParams();
    if (categoria) {
      params = params.set('categoria', categoria);
    }
    const termino = nombre?.trim();
    if (termino) {
      params = params.set('nombre', termino);
    }
    return this.http.get<SucursalMiniDTO[]>(`${this.api.baseUrl}/sucursales/listar/filtrar`, {
      params,
      context: contextoSilenciado(silenciarErroresGlobales),
    });
  }

  categorias(): Observable<string[]> {
    return this.http.get<string[]>(`${this.api.baseUrl}/sucursales/categorias`, {
      context: new HttpContext().set(SIN_MANEJO_GLOBAL_DE_ERRORES, true),
    });
  }

  /**
   * Detalle de una sucursal. `silenciarErroresGlobales` permite que la pantalla
   * que lo consume muestre su propio estado de error sin navegar a /error.
   */
  obtenerPorId(
    idSucursal: number,
    silenciarErroresGlobales = false,
  ): Observable<SucursalDetalleDTO> {
    const url = `${this.api.baseUrl}/sucursales/${idSucursal}`;
    if (!silenciarErroresGlobales) {
      return this.http.get<SucursalDetalleDTO>(url);
    }
    return this.http.get<SucursalDetalleDTO>(url, {
      context: new HttpContext().set(SIN_MANEJO_GLOBAL_DE_ERRORES, true),
    });
  }
}
