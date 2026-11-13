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

/** Registro resumido devuelto por los endpoints administrativos de usuarios. */
export interface UsuarioMiniAdminDTO {
  readonly id: number;
  readonly nombre: string;
  readonly apellido: string;
  readonly estado: boolean;
  readonly fotoPerfil: string | null;
}
