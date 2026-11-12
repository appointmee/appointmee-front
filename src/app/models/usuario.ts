import type { SucursalMiniDTO } from './sucursal';

/** DTO devuelto por `/usuarios/email`. */
export interface UsuarioResponseDTO {
  readonly id: number;
  readonly nombre: string;
  readonly apellido: string;
  readonly email: string;
  readonly urlFotoPerfil: string | null;
}

/** Respuesta de `GET /usuarios/{userId}` (`UsuarioPerfilResponseDTO` del backend). */
export interface UsuarioPerfilDTO {
  readonly id: number;
  readonly nombre: string;
  readonly apellido: string;
  readonly email: string;
  readonly fechaCreacion: string | null;
  readonly fotoPerfil: string | null;
  readonly roles: readonly string[];
  readonly sucursalesEmpleado: readonly SucursalMiniDTO[];
}

/** Campos editables de `PATCH /usuarios/modificar/{userId}`. */
export interface UsuarioModificarDTO {
  readonly nombre?: string;
  readonly apellido?: string;
  readonly email?: string;
  readonly fotoUrl?: string;
  readonly fotoPublicId?: string;
  readonly password?: string;
}
