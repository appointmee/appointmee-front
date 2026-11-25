import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { SIN_MANEJO_GLOBAL_DE_ERRORES } from '../http/error-handling-context';
import type {
  ConversacionDetalleChat,
  ConversacionResumenChat,
  MensajeChat,
} from '../models/chat';
import { backendService } from './backend-service';

/** Endpoints REST del chat. Los errores se resuelven inline en la vista. */
@Injectable({ providedIn: 'root' })
export class chatService {
  private readonly api = inject(backendService);
  private readonly http = inject(HttpClient);

  listar(): Observable<ConversacionResumenChat[]> {
    return this.http.get<ConversacionResumenChat[]>(
      `${this.api.baseUrl}/conversaciones`,
      { context: this.contextoSinAvisoGlobal() },
    );
  }

  obtener(conversacionId: number): Observable<ConversacionDetalleChat> {
    return this.http.get<ConversacionDetalleChat>(
      `${this.api.baseUrl}/conversaciones/${conversacionId}`,
      { context: this.contextoSinAvisoGlobal() },
    );
  }

  /** Sin `afterId` el backend devuelve los últimos mensajes; con él, solo lo nuevo. */
  listarMensajes(conversacionId: number, afterId?: number, size = 100): Observable<MensajeChat[]> {
    const params: Record<string, string> = { size: String(size) };
    if (afterId !== undefined) params['afterId'] = String(afterId);

    return this.http.get<MensajeChat[]>(
      `${this.api.baseUrl}/conversaciones/${conversacionId}/mensajes`,
      { params, context: this.contextoSinAvisoGlobal() },
    );
  }

  marcarLeido(conversacionId: number): Observable<unknown> {
    return this.http.patch(
      `${this.api.baseUrl}/conversaciones/${conversacionId}/leido`,
      {},
      { context: this.contextoSinAvisoGlobal() },
    );
  }

  private contextoSinAvisoGlobal(): HttpContext {
    return new HttpContext().set(SIN_MANEJO_GLOBAL_DE_ERRORES, true);
  }
}
