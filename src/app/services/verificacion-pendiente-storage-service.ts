import { Injectable } from '@angular/core';
import type { VerificacionPendiente } from '../models/auth';

function esVerificacionPendiente(datos: unknown): datos is VerificacionPendiente {
  if (typeof datos !== 'object' || datos === null) return false;

  const valor = datos as Record<string, unknown>;
  const email = valor['email'];
  const verificationToken = valor['verificationToken'];
  const expiresAt = valor['expiresAt'];
  const intentos = valor['intentos'];
  const reenviarDesde = valor['reenviarDesde'];

  return (
    typeof email === 'string'
    && typeof verificationToken === 'string'
    && verificationToken.length > 0
    && typeof expiresAt === 'number'
    && Number.isFinite(expiresAt)
    && expiresAt > Date.now()
    && typeof intentos === 'number'
    && Number.isInteger(intentos)
    && intentos >= 0
    && intentos <= 5
    && typeof reenviarDesde === 'number'
    && Number.isFinite(reenviarDesde)
  );
}

@Injectable({ providedIn: 'root' })
export class verificacionPendienteStorageService {

  private clave = 'verificacionPendiente';


  //  LEE el token de verificacion y lo valida
  leer(): VerificacionPendiente | null {
    try {
      const datos: unknown = JSON.parse(sessionStorage.getItem(this.clave) ?? 'null');
      return esVerificacionPendiente(datos) ? datos : null;
    } catch { return null; }
  }


  //guarda el token
  guardar(datos: VerificacionPendiente): void {
    // Autorización limitada de verificación; no guarda el código ni la contraseña.
    sessionStorage.setItem(this.clave, JSON.stringify(datos));
  }


  //limpia el token
  limpiar(): void { sessionStorage.removeItem(this.clave); }
}
