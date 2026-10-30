import { Injectable } from '@angular/core';

/**
 * Registro del 404 para observabilidad (criterio 9 de US-ERR-04).
 *
 * Sirve para detectar enlaces rotos: qué rutas caen en 404, desde dónde llegaron
 * y cuándo. Hoy el registro queda en consola como traza de error — las
 * herramientas de monitoreo client-side (Sentry, LogRocket, etc.) lo capturan
 * si/ cuando se configuren. Cuando haya provider propio, se enchufa acá
 * dentro de `registrar` y ninguna otra parte del código cambia.
 */
@Injectable({ providedIn: 'root' })
export class Reporte404 {
  registrar(ruta: string, referrer: string | null): void {
    // No se manda nada que exponga datos del usuario: solo ruta y origen.
    console.error('[404] enlace roto o contenido inexistente', {
      ruta,
      referrer,
      ts: new Date().toISOString(),
    });
  }
}
