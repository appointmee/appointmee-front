import { Injectable, inject } from '@angular/core';
import type { EstadoVerificacion, VerificacionPendiente } from '../models/auth';
import { verificacionPendienteStorageService } from './verificacion-pendiente-storage-service';

@Injectable({ providedIn: 'root' })
export class verificacionPendienteService {

  private readonly storage = inject(verificacionPendienteStorageService);


  leer(): VerificacionPendiente | null { return this.storage.leer(); }


  /** Guarda el contexto de verificación solo si el backend entregó un ticket válido. */
  guardarEmail(email: string, verificationToken?: string, expiresIn = 900): void {
    const normalizado = email.trim().toLowerCase();
    if (!normalizado) { this.limpiar(); return; }
    if (verificationToken) {
      this.storage.guardar({ email: normalizado, verificationToken, expiresAt: Date.now() + expiresIn * 1000,
        intentos: 0, reenviarDesde: 0, codigoVenceEn: 0, enviado: false });
    }
    // Un email escrito a mano no concede permiso para verificar una cuenta.
  }

  /** Copia los límites y vencimientos autoritativos del backend al estado local de interfaz. */
  aplicarEstado(estado: EstadoVerificacion): void {
    const datos = this.leer();
    if (!datos) return;
    this.storage.guardar({ ...datos,
      intentos: Math.max(0, Math.min(5, 5 - estado.attemptsRemaining)),
      reenviarDesde: Date.now() + Math.max(0, estado.retryAfterSeconds) * 1000,
      enviado: estado.enviado,
      codigoVenceEn: estado.enviado ? Date.now() + estado.expiresInSeconds * 1000 : 0,
    });
  }
  /**
   * Actualiza el contador local para feedback inmediato. El bloqueo real y la
   * cantidad restante los determina el backend y se sincronizan con aplicarEstado.
   */
  registrarError(attemptsRemaining?: number, retryAfterSeconds?: number): number {
    const datos = this.leer();
    if (!datos) return 0;
    datos.intentos = attemptsRemaining === undefined
      ? Math.min(5, datos.intentos + 1) : Math.max(0, Math.min(5, 5 - attemptsRemaining));
    if (retryAfterSeconds !== undefined) datos.reenviarDesde = Date.now() + retryAfterSeconds * 1000;
    this.storage.guardar(datos);
    return datos.intentos;
  }


  /** Segundos restantes antes de habilitar el reenvío según el último estado conocido. */
  segundosParaReenvio(): number {
    return Math.max(0, Math.ceil(((this.leer()?.reenviarDesde ?? 0) - Date.now()) / 1000));
  }

  /** Oculta el código vencido en la interfaz sin borrar el ticket de verificación. */
  marcarCodigoVencido(): void {
    const datos = this.leer();
    if (datos) this.storage.guardar({ ...datos, codigoVenceEn: 0 });
  }


  /** Calcula cuánto falta para que venza el código, o cero si ya no está vigente. */
  segundosDeVigencia(): number {
    const venceEn = this.leer()?.codigoVenceEn ?? 0;
    return Math.max(0, Math.ceil((venceEn - Date.now()) / 1000));
  }


  /** Descarta el ticket y el resto del estado temporal de verificación. */
  limpiar(): void { this.storage.limpiar(); }
}
