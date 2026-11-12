
/**
 * MOdelos Servicio
 */

export interface ServicioDTO {
  readonly id: number;
  readonly nombre: string;
  readonly descripcion: string | null;
  readonly duracion: number;
  readonly precio: number | string | null;
  readonly fotoPerfil: string | null;
  readonly puntuacion: number | null;
  readonly cantidadPuntuaciones: number | null;
  readonly nombreSucursal?: string | null;
  readonly direccionSucursal?: string | null;
  readonly categoriaSucursal?: string | null;
}

export interface ServicioPayload {
  readonly sucursalId: number;
  readonly nombre: string;
  readonly descripcion: string;
  readonly duracion: number;
  readonly precio: number | string;
  readonly fotoUrl: string;
  readonly fotoPublicId: string | null;
}

/**
 * Datos que acepta el endpoint `PATCH /servicios/modificar/{servicioId}`.
 *
 * Todos los campos son opcionales: el backend solo aplica los que recibe y
 * conserva el resto. `fotoUrl` y `fotoPublicId` van juntos y, si no se
 * envían, el servicio mantiene la imagen que ya tenía.
 */
export interface ServicioModificarPayload {
  readonly nombre?: string;
  readonly descripcion?: string;
  readonly duracion?: number;
  readonly precio?: number | string;
  readonly fotoUrl?: string;
  readonly fotoPublicId?: string | null;
}
