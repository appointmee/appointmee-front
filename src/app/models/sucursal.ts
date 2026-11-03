export interface SucursalMiniDTO {
  readonly id: number;
  readonly nombre: string;
  readonly categoria: string;
  readonly fotoPerfil: string | null;
  readonly puntuacion: number | null;
  readonly cantidadPuntuaciones: number;
  readonly diasApertura?: readonly string[];
}
