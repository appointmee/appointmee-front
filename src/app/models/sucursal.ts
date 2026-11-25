
/**
 * Modelos sucursal
 */

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
export interface SucursalPayload {
  readonly nombre: string;
  readonly direccion: string | null;
  readonly telefono: string | null;
  readonly descripcion: string | null;
  readonly categoria: string | null;
  readonly horaApertura: string | null;
  readonly horaCierre: string | null;
  readonly diasApertura: readonly string[] | null;
  readonly fotoPerfil: string | null;
}

export interface SucursalImagenDTO {
  readonly url: string;
  readonly descripcion?: string | null;
}

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
  readonly imagenes?: readonly (string | SucursalImagenDTO)[] | null;
  /** Pueden ser null en sucursales creadas antes de seleccionar ubicación. */
  readonly latitud?: number | null;
  readonly longitud?: number | null;
  readonly googlePlaceId?: string | null;
}

export interface SucursalPayload {
  readonly nombre: string;
  readonly direccion: string | null;
  readonly telefono: string | null;
  readonly descripcion: string | null;
  readonly categoria: string | null;
  readonly horaApertura: string | null;
  readonly horaCierre: string | null;
  readonly diasApertura: readonly string[] | null;
  readonly fotoPerfil: string | null;
}

/**
 * Datos que acepta `POST /sucursales/crear` (SucursalCrearDTO del backend).
 * La foto viaja como `fotoUrl` porque es la URL que devuelve el upload.
 */
export interface SucursalCrearPayload {
  readonly nombre: string;
  readonly direccion: string | null;
  readonly telefono: string | null;
  readonly descripcion: string | null;
  readonly categoriaId: number;
  readonly horaApertura: string | null;
  readonly horaCierre: string | null;
  readonly diasApertura: readonly string[];
  readonly fotoUrl: string;
  readonly fotoPublicId: string | null;
  readonly latitud?: number | null;
  readonly longitud?: number | null;
  readonly googlePlaceId?: string | null;
}

/**
 * Datos que acepta `PATCH /sucursales/modificar/{sucursalId}`
 * (SucursalModificarDTO del backend).
 *
 * El backend solo aplica los campos que llegan: `fotoUrl` viaja únicamente
 * cuando se elige una imagen nueva, para que la foto vigente se conserve.
 */
export interface SucursalModificarPayload {
  readonly nombre: string;
  readonly direccion: string | null;
  readonly telefono: string | null;
  readonly descripcion: string | null;
  readonly categoriaId: number;
  readonly horaApertura: string | null;
  readonly horaCierre: string | null;
  readonly diasApertura: readonly string[];
  readonly fotoUrl?: string | null;
  readonly fotoPublicId?: string | null;
  /** Solo se envían cuando se eligió otra ubicación; van siempre los tres juntos. */
  readonly latitud?: number | null;
  readonly longitud?: number | null;
  readonly googlePlaceId?: string | null;
}
