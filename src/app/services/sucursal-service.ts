import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { backendService } from './backend-service';
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

  obtenerPorId(id: number): Observable<SucursalDetalleDTO> {
    return this.http.get<SucursalDetalleDTO>(`${this.api.baseUrl}/sucursales/${id}`);
  }
}
