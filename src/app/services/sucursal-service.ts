import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { backendService } from './backend-service';
import { SIN_MANEJO_GLOBAL_DE_ERRORES } from '../http/error-handling-context';
import { SucursalDetalleDTO, SucursalMiniDTO, SucursalPayload } from '../models/sucursal';
import { UsuarioResponseDTO } from '../models/usuario';

/**
 * Devuelve un HttpContext que silencia el manejo global de errores para que la
 * pantalla consumidora presente su propio estado de error inline (sin navegar a
 * /error ni mostrar el aviso general).
 */
function contextoSilenciado(activado: boolean): HttpContext {
  return activado ? new HttpContext().set(SIN_MANEJO_GLOBAL_DE_ERRORES, true) : new HttpContext();
}

/** Acceso a sucursales públicas y a las operaciones autenticadas de gestión. */
@Injectable({ providedIn: 'root' })
export class sucursalService {
  private readonly api = inject(backendService);
  private readonly http = inject(HttpClient);

  /** Recupera el listado público; permite delegar errores al estado inline de la vista. */
  listar(silenciarErroresGlobales = false): Observable<SucursalMiniDTO[]> {
    return this.http.get<SucursalMiniDTO[]>(`${this.api.baseUrl}/sucursales/listar`, {
      context: contextoSilenciado(silenciarErroresGlobales),
    });
  }

  /** Filtra sucursales y omite parámetros vacíos para conservar el contrato REST. */
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
  /** Obtiene las categorías disponibles para construir los filtros de sucursales. */
  categorias(): Observable<string[]> {
    return this.http.get<string[]>(`${this.api.baseUrl}/sucursales/categorias`, {
      context: new HttpContext().set(SIN_MANEJO_GLOBAL_DE_ERRORES, true),
    });
  }

  /** Lista las sucursales propias del empleador autenticado. */
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

  /** Solicita incorporar el email indicado al equipo; propiedad y duplicados se validan en backend. */
  agregarEmpleado(sucursalId: number, email: string): Observable<string> {
    return this.http.post(
      `${this.api.baseUrl}/sucursales/${sucursalId}/empleados/agregar`,
      { email },
      { context: this.contextoSinAvisoGlobal(), responseType: 'text' },
    );
  }

  listarEmpleados(sucursalId: number): Observable<UsuarioResponseDTO[]> {
    return this.http.get<UsuarioResponseDTO[]>(
      `${this.api.baseUrl}/sucursales/${sucursalId}/empleados`,
      { context: this.contextoSinAvisoGlobal() },
    );
  }

  convertirmeEnEmpleado(sucursalId: number): Observable<string> {
    return this.http.patch(
      `${this.api.baseUrl}/sucursales/${sucursalId}/convertirme-empleado`,
      {},
      { context: this.contextoSinAvisoGlobal(), responseType: 'text' },
    );
  }

   /** Permite elegir si el error del detalle se maneja globalmente o en su propia pantalla. */
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

  /** Crea una sucursal y silencia el interceptor para mostrar errores junto al formulario. */
  crear(datos: SucursalPayload): Observable<string> {
    return this.http.post(`${this.api.baseUrl}/sucursales/crear`, datos, {
      context: contextoSilenciado(true),
      responseType: 'text',
    });
  }

  /** Actualiza la información editable de una sucursal existente. */
  actualizar(idSucursal: number, datos: SucursalPayload): Observable<SucursalDetalleDTO> {
    return this.http.put<SucursalDetalleDTO>(`${this.api.baseUrl}/sucursales/${idSucursal}`, datos, {
      context: contextoSilenciado(true),
    });
  }

  /** Solicita la baja lógica; la autorización de propiedad se verifica en el backend. */
  eliminar(idSucursal: number): Observable<void> {
    return this.http.delete<void>(`${this.api.baseUrl}/sucursales/${idSucursal}`, {
      context: contextoSilenciado(true),
    });
  }

  private contextoSinAvisoGlobal(): HttpContext {
    return new HttpContext().set(SIN_MANEJO_GLOBAL_DE_ERRORES, true);
  }
}
