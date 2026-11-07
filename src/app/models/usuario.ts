/** DTO devuelto por `/usuarios/email`. */
export interface UsuarioResponseDTO {
  readonly id: number;
  readonly nombre: string;
  readonly apellido: string;
  readonly email: string;
  readonly urlFotoPerfil: string | null;
}