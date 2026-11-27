import type { PaginaDTO, VistaPreviaDTO } from './paginacion';

/**
 * Modelos para la resenia
 */
export interface ReseniaDTO {
  readonly puntuacion: number;
  readonly comentario: string | null;
  readonly fechaResenia: string | null;
  /** Snapshot histórico del empleado; ausente en reseñas que no lo incluyeron. */
  readonly empleadoNombre?: string | null;
  readonly empleadoApellido?: string | null;
  readonly empleadoPerteneceASucursal?: boolean;
}

export interface ReseniaPayload {
  readonly puntuacion: number;
  readonly comentario: string | null;
  /** El backend toma el empleado del turno; por defecto no se incluye. */
  readonly incluirEmpleado?: boolean;
}

/** Vista previa del detalle: como máximo las últimas 5 reseñas. */
export type VistaPreviaReseniasDTO = VistaPreviaDTO<ReseniaDTO>;

/** Historial completo: 10 reseñas por página. */
export type PaginaReseniasDTO = PaginaDTO<ReseniaDTO>;
