/** Contrato comun de paginacion del backend (page/number son 0-based). */
export interface PaginaDTO<T> {
  readonly content: readonly T[];
  readonly totalElements: number;
  readonly totalPages: number;
  readonly number: number;
  readonly size: number;
}

/** Contenedor inicial de un listado: solo los primeros registros y si hay mas. */
export interface VistaPreviaDTO<T> {
  readonly content: readonly T[];
  readonly totalElements: number;
  readonly hayMas: boolean;
}

/** Tamano unico de pagina de los listados de esta historia. */
export const TAMANO_PAGINA = 10;
