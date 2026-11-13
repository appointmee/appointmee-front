import { fotoPerfilDe } from '../shared/foto-perfil';
import { UsuarioResponseDTO } from './usuario';

/**
 * MOdelos Empleado
 */
export interface EmpleadoDTO {
  readonly id: number;
  readonly nombre: string;
  readonly apellido: string;
  readonly urlFotoPerfil: string | null;
  readonly fotoPerfil?: string | null;
  readonly puntuacion: number | null;
  readonly cantidadPuntuaciones: number | null;
}

/**
 * Empleado de una sucursal para el gestor del empleador: reúne los datos de
 * `UsuarioResponseDTO` (listados por `/sucursales/{id}/empleados`) con la
 * puntuación promedio que expone `/sucursales/{id}/elegir-empleado`.
 */
export interface EmpleadoSucursalDTO extends UsuarioResponseDTO {
  readonly fotoPerfil?: string | null;
  readonly puntuacion: number | null;
  readonly cantidadPuntuaciones: number | null;
}

export interface EmpleadoPayload {
  readonly nombre: string;
  readonly apellido: string;
  readonly urlFotoPerfil: string | null;
}

/**
 * Une los datos de `UsuarioResponseDTO` con la puntuación promedio de
 * `EmpleadoDTO` usando el identificador del empleado. Los datos del usuario
 * siempre prevalecen y cada empleado aparece una sola vez en el resultado.
 */
export function combinarEmpleadosSucursal(
  usuarios: readonly UsuarioResponseDTO[],
  puntuaciones: readonly EmpleadoDTO[],
): readonly EmpleadoSucursalDTO[] {
  const porId = new Map<number, EmpleadoDTO>();
  for (const puntuacion of puntuaciones) {
    if (!porId.has(puntuacion.id)) {
      porId.set(puntuacion.id, puntuacion);
    }
  }

  const vistos = new Set<number>();
  const lista: EmpleadoSucursalDTO[] = [];

  for (const usuario of usuarios) {
    if (vistos.has(usuario.id)) {
      continue;
    }

    vistos.add(usuario.id);
    const puntuacion = porId.get(usuario.id);
    const foto = fotoPerfilDe(usuario) ?? fotoPerfilDe(puntuacion);

    lista.push({
      id: usuario.id,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      email: usuario.email,
      urlFotoPerfil: foto,
      fotoPerfil: foto,
      puntuacion: puntuacion?.puntuacion ?? null,
      cantidadPuntuaciones: puntuacion?.cantidadPuntuaciones ?? null,
    });
  }

  return lista;
}
