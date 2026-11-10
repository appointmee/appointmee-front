export interface DisponibilidadDTO {
  readonly fecha: string;
  readonly horarios: readonly string[];
}

export interface TurnoCrearPayload {
  readonly fechaHora: string;
  readonly empleadoId: number;
  readonly servicioId: number;
}

export interface TurnoCreadoDTO {
  readonly id: number;
  readonly fechaHora: string;
  readonly estado: string;
}
