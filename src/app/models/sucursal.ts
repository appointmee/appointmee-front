export interface SucursalMiniDTO {
  readonly id: number;
  readonly nombre: string;
  readonly categoria: string;
  readonly fotoPerfil: string | null;
  readonly puntuacion: number | null;
  readonly cantidadPuntuaciones: number;
  readonly diasApertura?: readonly string[];
}

/** Datos mínimos de la sucursal que necesita el flujo de reserva. */
export interface SucursalDetalleDTO {
  readonly id: number;
  readonly nombre: string;
  readonly direccion?: string | null;
  readonly categoria?: string | null;
  readonly fotoPerfil?: string | null;
}
