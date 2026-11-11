import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { backendService } from './backend-service';
import { SIN_MANEJO_GLOBAL_DE_ERRORES } from '../http/error-handling-context';
import { SucursalDetalleDTO, SucursalMiniDTO, SucursalPayload } from '../models/sucursal';

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

  //GET
  listar(silenciarErroresGlobales = false): Observable<SucursalMiniDTO[]> {
    return this.http.get<SucursalMiniDTO[]>(`${this.api.baseUrl}/sucursales/listar`, {
      context: contextoSilenciado(silenciarErroresGlobales),
    });
  }

  //GET
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
//GET CATEGORIAS
  categorias(): Observable<string[]> {
    return this.http.get<string[]>(`${this.api.baseUrl}/sucursales/categorias`, {
      context: new HttpContext().set(SIN_MANEJO_GLOBAL_DE_ERRORES, true),
    });
  }

  //GET
  listarPropias(): Observable<SucursalMiniDTO[]> {
    return this.http.get<SucursalMiniDTO[]>(
      `${this.api.baseUrl}/sucursales/listar/propias`,
      { context: this.contextoSinAvisoGlobal() },
    );
  }

  /** GET /sucursales/listar/como-empleado: sucursales donde el usuario es empleado. */
  listarComoEmpleado(): Observable<SucursalMiniDTO[]> {
    return this.http.get<SucursalMiniDTO[]>(
      `${this.api.baseUrl}/sucursales/listar/como-empleado`,
      { context: this.contextoSinAvisoGlobal() },
    );
  }

  agregarEmpleado(sucursalId: number, email: string): Observable<string> {
    return this.http.post(
      `${this.api.baseUrl}/sucursales/${sucursalId}/empleados/agregar`,
      { email },
      { context: this.contextoSinAvisoGlobal(), responseType: 'text' },
    );
  }

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

  crear(datos: SucursalPayload): Observable<SucursalDetalleDTO> {
    return this.http.post<SucursalDetalleDTO>(`${this.api.baseUrl}/sucursales`, datos, {
      context: contextoSilenciado(true),
    });
  }

  actualizar(idSucursal: number, datos: SucursalPayload): Observable<string> {
    const { nombre, direccion, telefono, descripcion, horaApertura, horaCierre, fotoPerfil } = datos;
    return this.http.patch(`${this.api.baseUrl}/sucursales/modificar/${idSucursal}`, {
      nombre,
      direccion,
      telefono,
      descripcion,
      horaApertura,
      horaCierre,
      fotoUrl: fotoPerfil,
    }, {
      context: contextoSilenciado(true),
      responseType: 'text',
    });
  }

  eliminar(idSucursal: number): Observable<void> {
    return this.http.delete<void>(`${this.api.baseUrl}/sucursales/${idSucursal}`, {
      context: contextoSilenciado(true),
    });
  }

  private contextoSinAvisoGlobal(): HttpContext {
    return new HttpContext().set(SIN_MANEJO_GLOBAL_DE_ERRORES, true);
  }
}
