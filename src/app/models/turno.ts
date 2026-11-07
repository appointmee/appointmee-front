export interface DisponibilidadDTO {
  fecha: string;
  horarios: readonly string[];
}

export interface HorarioSeleccionado {
  empleadoId: number;
  fecha: string;
  hora: string;
}
