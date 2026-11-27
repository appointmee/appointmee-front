import type { PaginaDTO } from './paginacion';
import { UsuarioResponseDTO } from './usuario';

export interface DisponibilidadDTO {
  fecha: string;
  horarios: readonly string[];
}

export interface HorarioSeleccionado {
  empleadoId: number;
  fecha: string;
  hora: string;
}

/** Estados que expone el backend para un turno. */
export type EstadoTurno =
  | 'PENDIENTE'
  | 'CONFIRMADO'
  | 'REALIZADO'
  | 'CANCELADO'
  | 'PAGO_RECHAZADO';

/** Cuerpo de POST /turnos/registrar. */
export interface TurnoCrearDTO {
  readonly fechaHora: string;
  readonly empleadoId: number;
  readonly servicioId: number;
}

/** Respuesta de GET /turnos/propios (TurnoMiniDTO del backend). */
export interface TurnoMiniDTO {
  readonly id: number;
  readonly nombreServicio: string;
  readonly fechaTurno: string;
  readonly estadoTurno: EstadoTurno;
  readonly puntuacion: number | null;
}

/** Respuesta de los listados paginados de turnos. */
export type PaginaTurnosDTO = PaginaDTO<TurnoMiniDTO>;

export interface UsuarioMiniDTO {
  readonly nombre: string;
  readonly apellido: string;
}

/** Datos históricos de la sucursal del turno (SucursalTurnoResponseDTO). */
export interface SucursalTurnoDTO {
  readonly id: number;
  readonly nombre: string;
  readonly direccion: string | null;
  readonly telefono: string | null;
  readonly categoria: string | null;
  readonly fotoPerfil: string | null;
}

export const MENSAJE_EMPLEADO_DESVINCULADO =
  'El empleado ya no pertenece a esta sucursal';
export const MENSAJE_SUCURSAL_DE_BAJA =
  'Esta sucursal ya no forma parte de AppointMee';

/** Respuesta de GET /turnos/de-sucursal/detalles/{turnoId} (TurnoResponseDTO). */
export interface TurnoEmpleadorDetalleDTO {
  readonly id: number;
  readonly fechaReserva: string;
  readonly fechaTurno: string;
  readonly estadoTurno: EstadoTurno;
  readonly cliente: UsuarioMiniDTO;
  readonly empleado: UsuarioResponseDTO;
  readonly servicio: ServicioTurnoDTO;
  readonly resenia: ReseniaTurnoDTO | null;
  readonly sucursal?: SucursalTurnoDTO | null;
  readonly empleadoActivo?: boolean;
  readonly empleadoPerteneceASucursal?: boolean;
  readonly sucursalActiva?: boolean;
}

export interface ServicioTurnoDTO {
  readonly id: number;
  readonly nombre: string;
  /** BigDecimal serializado por el backend. */
  readonly precio: number | string | null;
  readonly duracion: number;
}

export interface ReseniaTurnoDTO {
  readonly puntuacion: number | null;
  readonly comentario: string | null;
  readonly fechaResenia: string | null;
}

/**
 * Respuesta de GET /turnos/propios/detalles/{turnoId}
 * (TurnoClienteResponseDTO del backend).
 */
export interface TurnoClienteDetalleDTO {
  readonly fechaReserva: string;
  readonly fechaHora: string;
  readonly estadoTurno: EstadoTurno;
  readonly empleado: UsuarioMiniDTO;
  readonly servicio: ServicioTurnoDTO;
  readonly cliente: UsuarioMiniDTO;
  readonly resenia: ReseniaTurnoDTO | null;
  readonly sucursal?: SucursalTurnoDTO | null;
  readonly empleadoActivo?: boolean;
  readonly empleadoPerteneceASucursal?: boolean;
  readonly sucursalActiva?: boolean;
}
