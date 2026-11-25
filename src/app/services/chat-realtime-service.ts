import { HttpClient } from '@angular/common/http';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { Client, StompSubscription } from '@stomp/stompjs';

import type { MensajeChat } from '../models/chat';
import { authService } from './auth-service';
import { backendService } from './backend-service';

/** Convierte la URL REST del backend en la URL WebSocket del endpoint STOMP. */
export function urlWebSocketDesde(baseUrl: string): string {
  return `${baseUrl.replace(/^http/, 'ws').replace(/\/$/, '')}/ws`;
}

/** Fusiona mensajes sin duplicarlos y los deja ordenados por id. */
export function fusionarMensajes(
  actuales: MensajeChat[],
  entrantes: MensajeChat[],
): MensajeChat[] {
  const porId = new Map<number, MensajeChat>();
  const porIdCliente = new Set<string>();

  for (const mensaje of [...actuales, ...entrantes]) {
    if (porIdCliente.has(mensaje.clienteMensajeId)) continue;
    porIdCliente.add(mensaje.clienteMensajeId);
    porId.set(mensaje.id, mensaje);
  }

  return [...porId.values()].sort((a, b) => a.id - b.id);
}

/**
 * Conexión STOMP del chat. La vista (SCRUM-333) solo consume `mensajes` y
 * `conectado`, y llama a `enviar`. No contiene UI.
 */
@Injectable({ providedIn: 'root' })
export class chatRealtimeService {
  private readonly api = inject(backendService);
  private readonly auth = inject(authService);
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);

  private client: Client | null = null;
  private suscripcion: StompSubscription | null = null;
  private conversacionId: number | null = null;
  private ultimoId = 0;

  readonly conectado = signal(false);
  readonly mensajes = signal<MensajeChat[]>([]);

  constructor() {
    this.destroyRef.onDestroy(() => this.desconectar());
  }

  conectar(conversacionId: number, desdeId = 0): void {
    const token = this.auth.getAccessToken();
    if (!token) return;

    this.desconectar();
    this.conversacionId = conversacionId;
    this.ultimoId = desdeId;

    const client = new Client({
      brokerURL: urlWebSocketDesde(this.api.baseUrl),
      connectHeaders: { Authorization: `Bearer ${token}` },
      reconnectDelay: 3000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      onConnect: () => {
        this.conectado.set(true);
        this.suscribir();
        this.recuperarPendientes();
      },
      onWebSocketClose: () => this.conectado.set(false),
      onStompError: () => this.conectado.set(false),
    });

    this.client = client;
    client.activate();
  }

  enviar(contenido: string): boolean {
    const texto = contenido.trim();
    const id = this.conversacionId;
    if (!texto || id === null || texto.length > 2000 || !this.client?.connected) return false;

    this.client.publish({
      destination: `/app/conversaciones/${id}/mensajes`,
      body: JSON.stringify({ contenido: texto, clienteMensajeId: crypto.randomUUID() }),
    });
    return true;
  }

  desconectar(): void {
    this.suscripcion?.unsubscribe();
    this.suscripcion = null;
    this.client?.deactivate();
    this.client = null;
    this.conversacionId = null;
    this.conectado.set(false);
  }

  private suscribir(): void {
    const id = this.conversacionId;
    if (id === null || !this.client) return;

    this.suscripcion = this.client.subscribe(
      `/topic/conversaciones/${id}`,
      (frame) => {
        const mensaje = JSON.parse(frame.body) as MensajeChat;
        this.agregar([mensaje]);
        // El backend ignora el ACK de mensajes propios.
        this.client?.publish({
          destination: `/app/conversaciones/${id}/entregado`,
          body: String(mensaje.id),
        });
      },
    );
  }

  private recuperarPendientes(): void {
    const id = this.conversacionId;
    if (id === null) return;

    this.http
      .get<MensajeChat[]>(`${this.api.baseUrl}/conversaciones/${id}/mensajes`, {
        params: { afterId: String(this.ultimoId), size: '100' },
      })
      .subscribe((mensajes) => this.agregar(mensajes));
  }

  private agregar(mensajes: MensajeChat[]): void {
    const fusionados = fusionarMensajes(this.mensajes(), mensajes);
    this.mensajes.set(fusionados);
    const ultimo = fusionados[fusionados.length - 1];
    if (ultimo) this.ultimoId = ultimo.id;
  }
}
