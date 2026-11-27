import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { SIN_MANEJO_GLOBAL_DE_ERRORES } from '../http/error-handling-context';
import {
  FiltrosUsuariosAdmin,
  PaginaUsuariosAdminDTO,
  UsuarioMiniAdminDTO,
  UsuarioPerfilDTO,
  UsuarioResponseDTO,
} from '../models/usuario';
import { backendService } from './backend-service';

@Injectable({ providedIn: 'root' })
export class usuarioService {
  private readonly api = inject(backendService);
  private readonly http = inject(HttpClient);

  /**
   * `GET /usuarios/{userId}`: perfil del usuario autenticado. El backend solo
   * permite consultar el perfil propio (o cualquiera con rol administrador).
   */
  obtenerPerfil(userId: number): Observable<UsuarioPerfilDTO> {
    return this.http.get<UsuarioPerfilDTO>(`${this.api.baseUrl}/usuarios/${userId}`, {
      context: this.contextoSinAvisoGlobal(),
    });
  }

  /** Lista usuarios para el panel admin (el backend limita la cantidad máxima). */
  listarAdmin(): Observable<UsuarioMiniAdminDTO[]> {
    return this.http.get<UsuarioMiniAdminDTO[]>(`${this.api.baseUrl}/usuarios/listar`, {
      context: this.contextoSinAvisoGlobal(),
    });
  }

  /** Filtra usuarios según el contrato admin, con todos los filtros combinables. */
  filtrarAdmin(filtros: FiltrosUsuariosAdmin): Observable<UsuarioMiniAdminDTO[]> {
    return this.http.get<UsuarioMiniAdminDTO[]>(`${this.api.baseUrl}/usuarios/listar/filtrar`, {
      params: this.paramsDeFiltros(filtros),
      context: this.contextoSinAvisoGlobal(),
    });
  }

  /** Listado administrativo con filtros y paginación resueltos en la base. */
  listarPaginadoAdmin(
    filtros: FiltrosUsuariosAdmin,
    page: number,
  ): Observable<PaginaUsuariosAdminDTO> {
    return this.http.get<PaginaUsuariosAdminDTO>(`${this.api.baseUrl}/usuarios/listar/paginado`, {
      params: this.paramsDeFiltros(filtros).set('page', String(page)),
      context: this.contextoSinAvisoGlobal(),
    });
  }

  private paramsDeFiltros(filtros: FiltrosUsuariosAdmin): HttpParams {
    let params = new HttpParams();
    const valores: ReadonlyArray<readonly [string, string | undefined]> = [
      ['nombre', filtros.nombre],
      ['apellido', filtros.apellido],
      ['email', filtros.email],
      ['rol', filtros.rol],
      ['activo', filtros.activo === undefined ? undefined : String(filtros.activo)],
    ];
    for (const [clave, valor] of valores) {
      const texto = valor?.trim();
      if (texto) params = params.set(clave, texto);
    }
    return params;
  }

  /** Baja lógica administrativa. El backend restringe el endpoint a ADMINISTRADOR. */
  eliminarAdmin(id: number): Observable<string> {
    return this.http.delete(`${this.api.baseUrl}/usuarios/eliminar/${id}`, {
      context: this.contextoSinAvisoGlobal(),
      responseType: 'text',
    });
  }

  /** Reactiva una cuenta inactiva; el endpoint está restringido a ADMINISTRADOR. */
  activarAdmin(id: number): Observable<string> {
    return this.http.patch(`${this.api.baseUrl}/usuarios/activar/${id}`, null, {
      context: this.contextoSinAvisoGlobal(),
      responseType: 'text',
    });
  }

  buscarPorEmail(email: string): Observable<UsuarioResponseDTO> {
    return this.http.request<UsuarioResponseDTO>('GET', `${this.api.baseUrl}/usuarios/email`, {
      body: { email },
      context: this.contextoSinAvisoGlobal(),
    });
  }

  /**
   * Elimina la cuenta del usuario autenticado (`DELETE /usuarios/borrar-cuenta`).
   * El backend responde con un texto plano, por eso la respuesta se pide como
   * texto. El error se deja en manos de la pantalla para que pueda mostrarse
   * inline sin navegar a la vista de error.
   */
  borrarCuenta(): Observable<void> {
    return this.http
      .delete(`${this.api.baseUrl}/usuarios/borrar-cuenta`, {
        observe: 'response',
        responseType: 'text',
        context: this.contextoSinAvisoGlobal(),
      })
      .pipe(map(() => undefined));
  }

  modificarPerfil(id: number, datos: { nombre?: string; apellido?: string; fotoUrl?: string; fotoPublicId?: string }): Observable<string> {
    return this.http.patch(`${this.api.baseUrl}/usuarios/modificar/${id}`, datos, {
      responseType: 'text', context: this.contextoSinAvisoGlobal(),
    });
  }

  subirFotoPerfil(archivo: File): Observable<{ url: string; publicId: string; tokenCancelacion: string }> {
    const datos = new FormData();
    datos.append('file', archivo);
    return this.http.post<{ url: string; publicId: string; tokenCancelacion: string }>(
      `${this.api.baseUrl}/imagenes/upload?tipo=PERFIL`, datos, { context: this.contextoSinAvisoGlobal() },
    );
  }

  descartarFotoSubida(foto: { publicId: string; tokenCancelacion: string }): Observable<void> {
    return this.http.delete<void>(`${this.api.baseUrl}/imagenes/upload`, {
      body: { publicId: foto.publicId, tokenCancelacion: foto.tokenCancelacion },
      context: this.contextoSinAvisoGlobal(),
    });
  }

  restablecerFotoPerfil(): Observable<string> {
    return this.http.delete(`${this.api.baseUrl}/usuarios/eliminar/foto-perfil`, {
      responseType: 'text', context: this.contextoSinAvisoGlobal(),
    });
  }

  solicitarCambioEmail(email: string): Observable<void> {
    return this.http.post<void>(`${this.api.baseUrl}/usuarios/cambio-email/solicitar`, { email }, {
      context: this.contextoSinAvisoGlobal(),
    });
  }

  confirmarCambioEmail(email: string, codigo: string): Observable<void> {
    return this.http.post<void>(`${this.api.baseUrl}/usuarios/cambio-email/confirmar`, { email, codigo }, {
      context: this.contextoSinAvisoGlobal(),
    });
  }

  private contextoSinAvisoGlobal(): HttpContext {
    return new HttpContext().set(SIN_MANEJO_GLOBAL_DE_ERRORES, true);
  }
}
