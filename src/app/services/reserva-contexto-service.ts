import { Injectable } from '@angular/core';

export interface ReservaContexto {
  readonly sucursalId: number;
  readonly servicioId: number;
}

/** Contexto temporal de la reserva. La clave versionada evita recuperar formatos antiguos. */
@Injectable({ providedIn: 'root' })
export class reservaContextoService {
  private readonly clave = 'appointmee.reserva-contexto.v1';

  leer(sucursalId?: number): ReservaContexto | null {
    try {
      const raw = sessionStorage.getItem(this.clave);
      if (!raw) return null;

      const value: unknown = JSON.parse(raw);
      if (!this.esContexto(value) || (sucursalId !== undefined && value.sucursalId !== sucursalId)) {
        this.limpiar();
        return null;
      }
      return value;
    } catch {
      this.limpiar();
      return null;
    }
  }

  guardar(contexto: ReservaContexto): void {
    try {
      sessionStorage.setItem(this.clave, JSON.stringify(contexto));
    } catch {
      // La navegación sigue funcionando si el navegador bloquea el almacenamiento.
    }
  }

  limpiar(): void {
    try {
      sessionStorage.removeItem(this.clave);
    } catch {
      // No hay nada más que limpiar si el navegador bloquea el almacenamiento.
    }
  }

  private esContexto(value: unknown): value is ReservaContexto {
    if (typeof value !== 'object' || value === null) return false;
    const contexto = value as Partial<ReservaContexto>;
    return Number.isInteger(contexto.sucursalId) && contexto.sucursalId! > 0 &&
      Number.isInteger(contexto.servicioId) && contexto.servicioId! > 0;
  }
}
