/** DTO devuelto por `/usuarios/email`. */
export interface UsuarioResponseDTO {
  readonly id: number;
  readonly nombre: string;
  readonly apellido: string;
  readonly email: string;
  readonly urlFotoPerfil: string | null;
}

/** DTO devuelto por `/usuarios/listar` y `/usuarios/listar/filtrar` (admin). */
export interface UsuarioMiniAdminDTO {
  readonly id: number;
  readonly nombre: string;
  readonly apellido: string;
  readonly estado: boolean;
}

/** Sucursal resumida incluida en el perfil de usuario admin. */
export interface SucursalEmpleadoPerfilDTO {
  readonly id: number;
  readonly nombre: string;
  readonly categoria: string;
  readonly fotoPerfil: string | null;
  readonly puntuacion: number | null;
  readonly cantidadResenias: number;
  readonly diasApertura: readonly string[];
}

/** DTO devuelto por `/usuarios/{id}` (perfil/detalle). */
export interface UsuarioPerfilAdminDTO {
  readonly id: number;
  readonly nombre: string;
  readonly apellido: string;
  readonly email: string;
  readonly fechaCreacion: string;
  readonly fotoPerfil: string | null;
  readonly roles: readonly string[];
  readonly sucursalesEmpleado: readonly SucursalEmpleadoPerfilDTO[];
}

export interface FiltrosUsuariosAdmin {
  readonly nombre?: string;
  readonly apellido?: string;
  readonly activo?: boolean;
}