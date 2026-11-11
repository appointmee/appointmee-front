/**
 * MOdelos Empleado
 */
export interface EmpleadoDTO {
  readonly id: number;
  readonly nombre: string;
  readonly apellido: string;
  readonly urlFotoPerfil: string | null;
  readonly puntuacion: number | null;
  readonly cantidadPuntuaciones: number | null;
}

export interface EmpleadoPayload {
  readonly nombre: string;
  readonly apellido: string;
  readonly urlFotoPerfil: string | null;
}
