import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { backendService } from './backend-service';
import { SIN_MANEJO_GLOBAL_DE_ERRORES } from '../http/error-handling-context';
import { SucursalCrearPayload, SucursalDetalleDTO, SucursalMiniDTO, SucursalModificarPayload } from '../models/sucursal';
import { UsuarioResponseDTO } from '../models/usuario';

export interface SucursalGaleriaImagenDTO {
  readonly id: number;
  readonly url: string;
}

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

  /** Obtiene las categorías con su id (para crear sucursales). */
  categoriasConId(): Observable<{ id: number; categoria: string }[]> {
    return this.http.get<{ id: number; categoria: string }[]>(
      `${this.api.baseUrl}/sucursales/categorias/detalle`,
      { context: new HttpContext().set(SIN_MANEJO_GLOBAL_DE_ERRORES, true) },
    );
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

  listarImagenes(sucursalId: number): Observable<SucursalGaleriaImagenDTO[]> {
    return this.http.get<SucursalGaleriaImagenDTO[]>(
      `${this.api.baseUrl}/sucursales/${sucursalId}/imagenes`,
      { context: this.contextoSinAvisoGlobal() },
    );
  }

  subirImagenGaleria(sucursalId: number, archivo: File): Observable<SucursalGaleriaImagenDTO> {
    const datos = new FormData();
    datos.append('file', archivo);
    return this.http.post<SucursalGaleriaImagenDTO>(
      `${this.api.baseUrl}/sucursales/${sucursalId}/imagenes/upload`,
      datos,
      { context: this.contextoSinAvisoGlobal() },
    );
  }

  eliminarImagenGaleria(sucursalId: number, imagenId: number): Observable<string> {
    return this.http.delete(
      `${this.api.baseUrl}/sucursales/${sucursalId}/eliminar/imagen/${imagenId}`,
      { context: this.contextoSinAvisoGlobal(), responseType: 'text' },
    );
  }

  /** Crea una sucursal y silencia el interceptor para mostrar errores junto al formulario. */
  crear(datos: SucursalCrearPayload): Observable<string> {
    return this.http.post(`${this.api.baseUrl}/sucursales/crear`, datos, {
      context: contextoSilenciado(true),
      responseType: 'text',
    });
  }

  /**
   * Actualiza la información editable de una sucursal existente.
   *
   * El backend expone `PATCH /sucursales/modificar/{sucursalId}` y solo
   * aplica los campos que llegan en la petición: los que no se envían
   * conservan su valor actual (incluida la foto, si no se manda `fotoUrl`).
   * Responde con un texto plano, por eso se pide `responseType: 'text'`.
   */
  actualizar(idSucursal: number, datos: SucursalModificarPayload): Observable<string> {
    return this.http.patch(
      `${this.api.baseUrl}/sucursales/modificar/${idSucursal}`,
      datos,
      {
        context: contextoSilenciado(true),
        responseType: 'text',
      },
    );
  }

  /**
   * Elimina una sucursal propia del empleador.
   *
   * El backend expone `DELETE /sucursales/borrar-sucursal-propia/{sucursalId}`:
   * exige el rol EMPLEADOR y comprueba que la sucursal sea del empleador que
   * la pide. El endpoint devuelve un texto plano ("Se eliminó la sucursal"),
   * por eso se pide `responseType: 'text'` y el resultado se descarta.
   *
   * El otro endpoint de borrado, `DELETE /sucursales/eliminar/{sucursalId}`,
   * está reservado al administrador, así que no sirve para esta operación.
   */
  eliminar(idSucursal: number): Observable<void> {
    return this.http
      .delete(`${this.api.baseUrl}/sucursales/borrar-sucursal-propia/${idSucursal}`, {
        context: contextoSilenciado(true),
        responseType: 'text',
      })
      .pipe(map(() => undefined));
  }

  private contextoSinAvisoGlobal(): HttpContext {
    return new HttpContext().set(SIN_MANEJO_GLOBAL_DE_ERRORES, true);
  }
}
