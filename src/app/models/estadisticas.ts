export type EstadoTurnoGrafico =
  | 'PENDIENTE'
  | 'CONFIRMADO'
  | 'REALIZADO'
  | 'CANCELADO'
  | 'PAGO_RECHAZADO';

export type RolGrafico = 'CLIENTE' | 'EMPLEADOR' | 'EMPLEADO';
export type AgrupacionGrafico = 'DIA' | 'SEMANA' | 'MES';

export interface TurnosPeriodoGrafico {
  periodo: string;
  estados: Record<EstadoTurnoGrafico, number>;
}

export interface EmpleadorEstadisticas {
  desde: string;
  hasta: string;
  agrupacion: AgrupacionGrafico;
  turnosPorPeriodo: TurnosPeriodoGrafico[];
  demandaPorServicio: { servicioId: number; servicio: string; cantidad: number }[];
  cancelaciones: {
    cantidad: number;
    turnosConcluidos: number;
    tasa: number;
    porPeriodo: {
      periodo: string;
      cancelados: number;
      turnosConcluidos: number;
      tasa: number;
    }[];
  };
  ocupacion: { disponible: boolean; motivo: string };
  ingresos: { disponible: boolean; motivo: string };
  ausencias: { disponible: boolean; motivo: string };
}

export interface AdminEstadisticas {
  desde: string;
  hasta: string;
  agrupacion: AgrupacionGrafico;
  turnosPorPeriodo: TurnosPeriodoGrafico[];
  usuarios: {
    nuevosPorPeriodo: { periodo: string; altasPorRol: Partial<Record<RolGrafico, number>> }[];
    activosActualesPorRol: Partial<Record<RolGrafico, number>>;
  };
  sucursales: {
    nuevasPorPeriodo: { periodo: string; nuevas: number }[];
    activasActualmente: number;
    inactivasActualmente: number;
  };
}
