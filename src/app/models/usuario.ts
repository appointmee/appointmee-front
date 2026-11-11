/** DTO devuelto por `/usuarios/email`. */
export interface UsuarioResponseDTO {
  readonly id: number;
  readonly nombre: string;
  readonly apellido: string;
  readonly email: string;
  readonly urlFotoPerfil: string | null;
}

/** Campos editables de UsuarioModificarDTO; la contraseña se excluye del flujo de perfil. */
export interface UsuarioModificarPayload {
  readonly nombre: string;
  readonly apellido: string;
  readonly email: string;
  readonly fotoUrl: string | null;
}
