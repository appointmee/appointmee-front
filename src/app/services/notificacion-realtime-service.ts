import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { Client, StompSubscription } from '@stomp/stompjs';

import type { NotificacionDTO } from '../models/notificacion';
import { authService } from './auth-service';
import { backendService } from './backend-service';
import { urlWebSocketDesde } from './chat-realtime-service';
import { notificacionesCambiosService } from './notificaciones-cambios-service';

/** Canal privado por email: el back publica aquí cada notificación nueva. */
export function destinoNotificaciones(email: string): string {
  return `/topic/notificaciones/${email.trim().toLowerCase()}`;
}

/**
 * Suscripción STOMP al centro de notificaciones. No contiene UI: al recibir
 * una notificación nueva avisa al servicio compartido de cambios, que hace
 * recargar el panel y la vista /notificaciones.
 */
@Injectable({ providedIn: 'root' })
export class notificacionRealtimeService {
  private readonly api = inject(backendService);
  private readonly auth = inject(authService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cambios = inject(notificacionesCambiosService);

  private client: Client | null = null;
  private suscripcion: StompSubscription | null = null;
  private suscritoA: string | null = null;

  readonly conectado = signal(false);
  readonly ultima = signal<NotificacionDTO | null>(null);

  constructor() {
    this.destroyRef.onDestroy(() => this.desconectar());
  }

  conectar(): void {
    const token = this.auth.getAccessToken?.();
    const email = this.auth.perfil?.()?.email;
    if (!token || !email) return;

    const destino = destinoNotificaciones(email);
    if (this.client?.connected && this.suscritoA === destino) return;

    this.desconectar();
    this.suscritoA = destino;

    const client = new Client({
      brokerURL: urlWebSocketDesde(this.api.baseUrl),
      connectHeaders: { Authorization: `Bearer ${token}` },
      reconnectDelay: 3000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      onConnect: () => {
        this.conectado.set(true);
        this.suscribir(destino);
      },
      onWebSocketClose: () => this.conectado.set(false),
      onStompError: () => this.conectado.set(false),
    });

    this.client = client;
    client.activate();
  }

  desconectar(): void {
    this.suscripcion?.unsubscribe();
    this.suscripcion = null;
    this.client?.deactivate();
    this.client = null;
    this.suscritoA = null;
    this.conectado.set(false);
  }

  private suscribir(destino: string): void {
    if (!this.client) return;

    this.suscripcion = this.client.subscribe(destino, (frame) => {
      try {
        const notificacion = JSON.parse(frame.body) as NotificacionDTO;
        this.ultima.set(notificacion);
        this.cambios.notificarCambio();
      } catch {
        // Un frame malformado no debe romper la suscripción.
      }
    });
  }
}
