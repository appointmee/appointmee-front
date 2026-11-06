export interface ServicioDTO {
  readonly id: number;
  readonly nombre: string;
  readonly descripcion: string | null;
  readonly duracion: number;
  /** BigDecimal serializado por el backend. */
  readonly precio: number | string | null;
  readonly fotoPerfil: string | null;
  readonly puntuacion: number | null;
  readonly cantidadPuntuaciones: number | null;
  readonly nombreSucursal?: string | null;
  readonly direccionSucursal?: string | null;
  readonly categoriaSucursal?: string | null;
}
