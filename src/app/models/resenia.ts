/**
 * Respuesta de GET /sucursales/{id}/resenias (ReseniaResponseDTO del backend).
 */
export interface ReseniaDTO {
  readonly puntuacion: number;
  readonly comentario: string | null;
  readonly fechaResenia: string | null;
}
