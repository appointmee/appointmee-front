import { Injectable } from '@angular/core';
import type { EstadoVerificacion, VerificacionPendiente } from '../models/auth';

@Injectable({ providedIn: 'root' })
export class verificacionPendienteService {

  private clave = 'verificacionPendiente';

  leer(): VerificacionPendiente | null {
    try {
      const datos = JSON.parse(sessionStorage.getItem(this.clave) ?? 'null');
      return datos && typeof datos.email === 'string'
        && typeof datos.verificationToken === 'string' && datos.verificationToken.length > 0
        && Number.isFinite(datos.expiresAt) && datos.expiresAt > Date.now()
        && Number.isInteger(datos.intentos) && datos.intentos >= 0 && datos.intentos <= 5
        && Number.isFinite(datos.reenviarDesde) ? datos : null;
    } catch { return null; }
  }


  guardarEmail(email: string, verificationToken?: string, expiresIn = 900): void {
    const normalizado = email.trim().toLowerCase();
    if (!normalizado) { this.limpiar(); return; }
    if (verificationToken) {
      this.guardar({ email: normalizado, verificationToken, expiresAt: Date.now() + expiresIn * 1000,
        intentos: 0, reenviarDesde: 0, codigoVenceEn: 0, enviado: false });
    }
    // Un email escrito a mano no concede permiso para verificar una cuenta.
  }


  aplicarEstado(estado: EstadoVerificacion): void {
    const datos = this.leer();
    if (!datos) return;
    this.guardar({ ...datos,
      intentos: Math.max(0, Math.min(5, 5 - estado.attemptsRemaining)),
      reenviarDesde: Date.now() + Math.max(0, estado.retryAfterSeconds) * 1000,
      enviado: estado.enviado,
      codigoVenceEn: estado.enviado ? Date.now() + estado.expiresInSeconds * 1000 : 0,
    });
  }


  registrarError(attemptsRemaining?: number, retryAfterSeconds?: number): number {
    const datos = this.leer();
    if (!datos) return 0;
    datos.intentos = attemptsRemaining === undefined
      ? Math.min(5, datos.intentos + 1) : Math.max(0, Math.min(5, 5 - attemptsRemaining));
    if (retryAfterSeconds !== undefined) datos.reenviarDesde = Date.now() + retryAfterSeconds * 1000;
    this.guardar(datos);
    return datos.intentos;
  }


  segundosParaReenvio(): number {
    return Math.max(0, Math.ceil(((this.leer()?.reenviarDesde ?? 0) - Date.now()) / 1000));
  }

  marcarCodigoVencido(): void {
    const datos = this.leer();
    if (datos) this.guardar({ ...datos, codigoVenceEn: 0 });
  }

  segundosDeVigencia(): number {
    const venceEn = this.leer()?.codigoVenceEn ?? 0;
    return Math.max(0, Math.ceil((venceEn - Date.now()) / 1000));
  }

  limpiar(): void { sessionStorage.removeItem(this.clave); }

  private guardar(datos: VerificacionPendiente): void {
    // Autorización limitada de verificación; no guarda el código ni la contraseña.
    sessionStorage.setItem(this.clave, JSON.stringify(datos));
  }
}
