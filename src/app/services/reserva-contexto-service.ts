import { Injectable, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';

/**
 * Contexto temporal de una reserva en curso (sucursal y, si corresponde,
 * el servicio elegido).
 *
 * - Vive en `sessionStorage` (nunca `localStorage`) con una clave versionada
 *   (`appointmee.reserva-contexto.v1`) para no restaurar datos viejos.
 * - Guarda solo IDs numéricos: nunca nombres, precios ni datos sensibles.
 * - Se limpia cuando la reserva se finaliza o se cancela, o cuando el contexto
 *   ya no es válido.
 */
export const VERSION_CONTEXTO_RESERVA = 1;

export interface ContextoReserva {
  readonly version: number;
  readonly sucursalId: number;
  readonly servicioId: number | null;
}

@Injectable({ providedIn: 'root' })
export class reservaContextoService {
  private static readonly CLAVE = 'appointmee.reserva-contexto.v1';

  private contexto: ContextoReserva | null = null;

  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    this.contexto = this.leer();
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        // El contexto temporal sólo vive dentro del flujo de reserva. Al salir
        // de él (finalizar, cancelar o navegar a otra pantalla) se descarta.
        if (this.contexto && !this.esRutaDeReserva(event.urlAfterRedirects)) {
          this.limpiar();
        }
      });
  }

  /** Guarda (o sobreescribe) el contexto temporal de la reserva. */
  guardar(sucursalId: number, servicioId: number | null = null): ContextoReserva {
    const contexto: ContextoReserva = { version: VERSION_CONTEXTO_RESERVA, sucursalId, servicioId };
    this.contexto = contexto;
    this.persistente(contexto);
    return contexto;
  }

  obtener(): ContextoReserva | null {
    return this.contexto;
  }

  /** Servicio elegido vigente para la sucursal, si corresponde. */
  servicioSeleccionado(sucursalId: number): number | null {
    const contexto = this.contexto;
    if (!contexto || contexto.sucursalId !== sucursalId || contexto.servicioId === null) {
      return null;
    }
    return contexto.servicioId;
  }

  /** Limpia el contexto temporal: reserva finalizada, cancelada o inválida. */
  limpiar(): void {
    this.contexto = null;
    try {
      sessionStorage.removeItem(reservaContextoService.CLAVE);
    } catch {
      // Si el navegador bloquea el storage la reserva sigue siendo utilizable
      // durante la sesión; no se debe romper la navegación por el fallo.
    }
  }

  private leer(): ContextoReserva | null {
    try {
      const valor: unknown = JSON.parse(sessionStorage.getItem(reservaContextoService.CLAVE) ?? 'null');
      if (!valor || typeof valor !== 'object') {
        return null;
      }
      const candidato = valor as Partial<ContextoReserva>;
      const version = Number(candidato.version);
      const sucursalId = Number(candidato.sucursalId);
      const servicioId =
        candidato.servicioId === null || candidato.servicioId === undefined
          ? null
          : Number(candidato.servicioId);
      const versionValida = Number.isInteger(version) && version === VERSION_CONTEXTO_RESERVA;
      const sucursalValida = Number.isInteger(sucursalId) && sucursalId > 0;
      const servicioValido = servicioId === null || (Number.isInteger(servicioId) && servicioId > 0);
      if (!versionValida || !sucursalValida || !servicioValido) {
        return null;
      }
      return { version, sucursalId, servicioId };
    } catch {
      return null;
    }
  }

  private persistente(contexto: ContextoReserva): void {
    try {
      sessionStorage.setItem(reservaContextoService.CLAVE, JSON.stringify(contexto));
    } catch {
      // Sin storage disponible el contexto se mantiene en memoria de la sesión.
    }
  }

  private esRutaDeReserva(url: string): boolean {
    const ruta = (url ?? '').split('?')[0].split('#')[0];
    const segmentos = ruta.split('/').filter((segmento) => segmento.length > 0);
    if (segmentos[0] === 'servicios') {
      const sucursalId = Number(new URLSearchParams(url.split('?')[1] ?? '').get('sucursalId') ?? '');
      return Number.isInteger(sucursalId) && sucursalId > 0;
    }
    if (segmentos[0] !== 'sucursal' || segmentos.length < 2) {
      return false;
    }
    const sucursalId = Number(segmentos[1]);
    if (!Number.isInteger(sucursalId) || sucursalId <= 0) {
      return false;
    }
    if (segmentos.length === 2) {
      return true;
    }
    if (segmentos.length === 3 && segmentos[2] === 'profesionales') {
      return true;
    }
    if (segmentos[2] !== 'servicios') {
      return false;
    }
    if (segmentos.length === 3) {
      return true;
    }
    if (segmentos.length === 4) {
      return true;
    }
    if (segmentos.length === 5) {
      return segmentos[4] === 'turnos' || segmentos[4] === 'empleados';
    }
    return false;
  }
}
