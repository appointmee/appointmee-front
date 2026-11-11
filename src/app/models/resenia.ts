/**
 * Modelos para la resenia
 */
export interface ReseniaDTO {
  readonly puntuacion: number;
  readonly comentario: string | null;
  readonly fechaResenia: string | null;
}

export interface ReseniaPayload {
  readonly puntuacion: number;
  readonly comentario: string | null;
}
