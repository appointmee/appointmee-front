/** Categorías conocidas hoy; el tipo se mantiene abierto para tolerar valores nuevos del backend. */
export const BRANCH_CATEGORIES = [
  'PELUQUERIA',
  'SPA',
  'VETERINARIA',
  'ODONTOLOGIA',
  'PODOLOGIA',
  'TATUAJE',
  'MANICURA',
  'BARBERIA',
  'PELUQUERIA_CANINA',
  'FOTOGRAFIA',
  'OCULISTA',
  'MASAJE',
  'DEPILACION',
] as const;

export type BranchCategory = string;

export interface BranchSummary {
  readonly id: number;
  readonly nombre: string;
  readonly categoria: BranchCategory;
  readonly fotoPerfil: string | null;
  readonly puntuacion: number | null;
  readonly cantidadPuntuaciones: number;
}

export interface BranchFilters {
  readonly categoria?: BranchCategory;
  readonly nombre?: string;
}
