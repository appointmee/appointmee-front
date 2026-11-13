/**
 * Modelo compartido por el formulario de alta y el de modificación de
 * sucursales (US-SUC-02).
 *
 * Ambos usan exactamente los mismos campos y las mismas validaciones: por eso
 * el modelo vive aparte del componente, para que las dos pantallas puedan
 * precargar los datos de la sucursal sin duplicar el contrato.
 */

/** Valores que maneja el formulario de sucursal. */
export interface SucursalFormModel {
  nombre: string;
  direccion: string;
  telefono: string;
  descripcion: string;
  categoria: string;
  horaApertura: string;
  horaCierre: string;
  diasApertura: string[];
}

/** Categoría disponible para el formulario, con el id que espera el backend. */
export interface CategoriaSucursal {
  readonly id: number;
  readonly nombre: string;
}

/** Días de la semana en el orden en que los muestra la aplicación. */
export const DIAS_SUCURSAL = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
] as const;

/** Abreviaturas de los días, como las usa el resto de la aplicación. */
export const ABREVIATURAS_DIAS: Readonly<Record<string, string>> = {
  MONDAY: 'LU',
  TUESDAY: 'MA',
  WEDNESDAY: 'MI',
  THURSDAY: 'JU',
  FRIDAY: 'VI',
  SATURDAY: 'SA',
  SUNDAY: 'DO',
};

/** Modelo con todos los campos vacíos, para iniciar el formulario. */
export const SUCURSAL_FORM_VACIO: SucursalFormModel = {
  nombre: '',
  direccion: '',
  telefono: '',
  descripcion: '',
  categoria: '',
  horaApertura: '',
  horaCierre: '',
  diasApertura: [],
};

/**
 * Datos listos para enviar al backend, ya validados y normalizados.
 *
 * `fotoUrl` es la URL de la foto que se debe guardar: en el alta siempre
 * viene; en la modificación es `null` cuando el empleador no eligió una
 * imagen nueva, para que la sucursal conserve la que ya tiene.
 */
export interface SucursalFormDatos {
  nombre: string;
  direccion: string | null;
  telefono: string | null;
  descripcion: string | null;
  categoriaId: number;
  horaApertura: string | null;
  horaCierre: string | null;
  diasApertura: string[];
  fotoUrl: string | null;
  fotoPublicId: string | null;
}
