import type { PaginaDTO, VistaPreviaDTO } from './paginacion';

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

/** Vista previa del detalle: como máximo las últimas 5 reseñas. */
export type VistaPreviaReseniasDTO = VistaPreviaDTO<ReseniaDTO>;

/** Historial completo: 10 reseñas por página. */
export type PaginaReseniasDTO = PaginaDTO<ReseniaDTO>;
