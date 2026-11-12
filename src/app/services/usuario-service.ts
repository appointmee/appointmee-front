import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { SIN_MANEJO_GLOBAL_DE_ERRORES } from '../http/error-handling-context';
import {
  FiltrosUsuariosAdmin,
  UsuarioMiniAdminDTO,
  UsuarioPerfilAdminDTO,
  UsuarioResponseDTO,
} from '../models/usuario';
import { backendService } from './backend-service';

@Injectable({ providedIn: 'root' })
export class usuarioService {
  private readonly api = inject(backendService);
  private readonly http = inject(HttpClient);

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

  listarUsuariosAdmin(): Observable<UsuarioMiniAdminDTO[]> {
    return this.http.get<UsuarioMiniAdminDTO[]>(`${this.api.baseUrl}/usuarios/listar`, {
      context: this.contextoSinAvisoGlobal(),
    });
  }

  filtrarUsuariosAdmin(filtros: FiltrosUsuariosAdmin): Observable<UsuarioMiniAdminDTO[]> {
    let params = new HttpParams();
    if (filtros.nombre?.trim()) params = params.set('nombre', filtros.nombre.trim());
    if (filtros.apellido?.trim()) params = params.set('apellido', filtros.apellido.trim());
    if (filtros.activo !== undefined) params = params.set('activo', String(filtros.activo));

    return this.http.get<UsuarioMiniAdminDTO[]>(`${this.api.baseUrl}/usuarios/listar/filtrar`, {
      params,
      context: this.contextoSinAvisoGlobal(),
    });
  }

  verDetalleUsuarioAdmin(id: number): Observable<UsuarioPerfilAdminDTO> {
    return this.http.get<UsuarioPerfilAdminDTO>(`${this.api.baseUrl}/usuarios/${id}`, {
      context: this.contextoSinAvisoGlobal(),
    });
  }

  eliminarUsuarioAdmin(id: number): Observable<string> {
    return this.http.delete(`${this.api.baseUrl}/usuarios/eliminar/${id}`, {
      context: this.contextoSinAvisoGlobal(),
      responseType: 'text',
    });
  }

  private contextoSinAvisoGlobal(): HttpContext {
    return new HttpContext().set(SIN_MANEJO_GLOBAL_DE_ERRORES, true);
  }
}
