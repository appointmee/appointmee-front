import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { SIN_MANEJO_GLOBAL_DE_ERRORES } from '../http/error-handling-context';
import { UsuarioPerfilDTO, UsuarioResponseDTO } from '../models/usuario';
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

  private contextoSinAvisoGlobal(): HttpContext {
    return new HttpContext().set(SIN_MANEJO_GLOBAL_DE_ERRORES, true);
  }
}