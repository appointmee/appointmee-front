/** Formato común de errores del frontend; `message` siempre es seguro para UI. */
export interface FrontendError {
  readonly code: string;
  readonly message: string;
  readonly status: number;
}
