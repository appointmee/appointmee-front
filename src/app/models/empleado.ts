/**
 * Respuesta de GET /sucursales/{id}/elegir-empleado (EmpleadoResponseDTO del backend).
 * La puntuación llega ya redondeada y es null cuando el profesional todavía
 * no tiene reseñas.
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
