import { Injectable, inject } from '@angular/core';
import type { EstadoVerificacion, VerificacionPendiente } from '../models/auth';
import { verificacionPendienteStorageService } from './verificacion-pendiente-storage-service';

@Injectable({ providedIn: 'root' })
export class verificacionPendienteService {

  private readonly storage = inject(verificacionPendienteStorageService);


  leer(): VerificacionPendiente | null { return this.storage.leer(); }


  //  POST EMAIL
  guardarEmail(email: string, verificationToken?: string, expiresIn = 900): void {
    const normalizado = email.trim().toLowerCase();
    if (!normalizado) { this.limpiar(); return; }
    if (verificationToken) {
      this.storage.guardar({ email: normalizado, verificationToken, expiresAt: Date.now() + expiresIn * 1000,
        intentos: 0, reenviarDesde: 0, codigoVenceEn: 0, enviado: false });
    }
    // Un email escrito a mano no concede permiso para verificar una cuenta.
  }

  //sincroniza el estado que devuelve el backend con el de storage 
  
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
// cada vez que el usuario se equivoca al ingresar el codibgo de verificacion lo registra (localmente)
// y si falla 5 veces se bloquea la verificacion

  registrarError(attemptsRemaining?: number, retryAfterSeconds?: number): number {
    const datos = this.leer();
    if (!datos) return 0;
    datos.intentos = attemptsRemaining === undefined
      ? Math.min(5, datos.intentos + 1) : Math.max(0, Math.min(5, 5 - attemptsRemaining));
    if (retryAfterSeconds !== undefined) datos.reenviarDesde = Date.now() + retryAfterSeconds * 1000;
    this.storage.guardar(datos);
    return datos.intentos;
  }


  // Segundos que hacen falta para permitir reenviar la verificacion

  segundosParaReenvio(): number {
    return Math.max(0, Math.ceil(((this.leer()?.reenviarDesde ?? 0) - Date.now()) / 1000));
  }

  //Marca el codigo como vencido

  marcarCodigoVencido(): void {
    const datos = this.leer();
    if (datos) this.storage.guardar({ ...datos, codigoVenceEn: 0 });
  }


  //Calcula los segundos que faltan para que venza el codigo de verificacion
  segundosDeVigencia(): number {
    const venceEn = this.leer()?.codigoVenceEn ?? 0;
    return Math.max(0, Math.ceil((venceEn - Date.now()) / 1000));
  }


  //limpia el token
  limpiar(): void { this.storage.limpiar(); }
}
