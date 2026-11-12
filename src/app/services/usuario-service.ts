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