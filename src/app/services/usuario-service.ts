import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { SIN_MANEJO_GLOBAL_DE_ERRORES } from '../http/error-handling-context';
import { UsuarioModificarPayload, UsuarioResponseDTO } from '../models/usuario';
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

  obtenerPorId(id: number): Observable<UsuarioResponseDTO> {
    return this.http.get<UsuarioResponseDTO>(`${this.api.baseUrl}/usuarios/${id}`, {
      context: this.contextoSinAvisoGlobal(),
    });
  }

  actualizar(id: number, datos: UsuarioModificarPayload): Observable<string> {
    return this.http.patch(`${this.api.baseUrl}/usuarios/modificar/${id}`, datos, {
      context: this.contextoSinAvisoGlobal(),
      responseType: 'text',
    });
  }

  eliminarFotoPerfil(): Observable<string> {
    return this.http.delete(`${this.api.baseUrl}/usuarios/eliminar/foto-perfil`, {
      context: this.contextoSinAvisoGlobal(),
      responseType: 'text',
    });
  }

  private contextoSinAvisoGlobal(): HttpContext {
    return new HttpContext().set(SIN_MANEJO_GLOBAL_DE_ERRORES, true);
  }
}
