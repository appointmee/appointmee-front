// The API may add enum values before this frontend is redeployed.
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
