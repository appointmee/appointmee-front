import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { backendService } from './backend-service';
import { SIN_MANEJO_GLOBAL_DE_ERRORES } from '../http/error-handling-context';
import { SucursalDetalleDTO, SucursalMiniDTO, SucursalPayload } from '../models/sucursal';

// CRUD SUCURSAL

@Injectable({ providedIn: 'root' })
export class sucursalService {
  private readonly api = inject(backendService);
  private readonly http = inject(HttpClient);
//GET
  listar(): Observable<SucursalMiniDTO[]> {
    return this.http.get<SucursalMiniDTO[]>(`${this.api.baseUrl}/sucursales/listar`);
  }

  //GET
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
//GET CATEGORIAS
  categorias(): Observable<string[]> {
    return this.http.get<string[]>(`${this.api.baseUrl}/sucursales/categorias`);
  }
//GET
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
//POST
  crear(datos: SucursalPayload): Observable<SucursalDetalleDTO> {
    return this.http.post<SucursalDetalleDTO>(`${this.api.baseUrl}/sucursales`, datos);
  }
//PUT
  actualizar(idSucursal: number, datos: SucursalPayload): Observable<SucursalDetalleDTO> {
    return this.http.put<SucursalDetalleDTO>(`${this.api.baseUrl}/sucursales/${idSucursal}`, datos);
  }
  //DELETE
  eliminar(idSucursal: number): Observable<void> {
    return this.http.delete<void>(`${this.api.baseUrl}/sucursales/${idSucursal}`);
  }
}
