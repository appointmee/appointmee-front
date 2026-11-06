export interface SucursalMiniDTO {
  readonly id: number;
  readonly nombre: string;
  readonly categoria: string;
  readonly fotoPerfil: string | null;
  readonly puntuacion: number | null;
  readonly cantidadPuntuaciones: number;
  readonly diasApertura?: readonly string[];
}

/**
 * Respuesta de GET /sucursales/{id} (SucursalResponseDTO del backend).
 * Solo se tipan los campos que consume el detalle: el endpoint también
 * devuelve datos del empleador y de los empleados que no se muestran.
 */
export interface SucursalDetalleDTO {
  readonly id: number;
  readonly nombre: string;
  readonly direccion: string | null;
  readonly telefono: string | null;
  readonly descripcion: string | null;
  readonly fechaCreacion: string | null;
  readonly categoria: string | null;
  readonly horaApertura: string | null;
  readonly horaCierre: string | null;
  readonly diasApertura: readonly string[] | null;
  readonly puntuacion: number | null;
  readonly cantidadPuntuaciones: number | null;
  readonly fotoPerfil: string | null;
}
