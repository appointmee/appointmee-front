import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { backendService } from './backend-service';
import { SIN_MANEJO_GLOBAL_DE_ERRORES } from '../http/error-handling-context';
import { SucursalDetalleDTO, SucursalMiniDTO } from '../models/sucursal';

@Injectable({ providedIn: 'root' })
export class sucursalService {
  private readonly api = inject(backendService);

  private readonly http = inject(HttpClient);

  listar(): Observable<SucursalMiniDTO[]> {
    return this.http.get<SucursalMiniDTO[]>(`${this.api.baseUrl}/sucursales/listar`);
  }

  filtrar(categoria?: string | null, nombre?: string | null): Observable<SucursalMiniDTO[]> {
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
    });
  }

  categorias(): Observable<string[]> {
    return this.http.get<string[]>(`${this.api.baseUrl}/sucursales/categorias`);
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
