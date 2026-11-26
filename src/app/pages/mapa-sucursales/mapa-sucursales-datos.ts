import { SucursalMiniDTO } from '../../models/sucursal';
import {
  claveComparacionBusqueda,
  esTerminoNumerico,
  normalizarTerminoBusqueda,
} from '../../shared/busqueda-sucursales';

/**
 * El endpoint público `/sucursales/listar` devuelve estas coordenadas, aunque
 * el modelo compartido del listado tradicional no las declare. Se tipan aquí
 * para no modificar un modelo usado por otras pantallas.
 */
export interface SucursalMapaDTO extends SucursalMiniDTO {
  readonly latitud?: number | null;
  readonly longitud?: number | null;
}

export interface CoordenadasMapa {
  readonly lat: number;
  readonly lng: number;
}

/** Solo se marcan posiciones numéricas y dentro del rango válido de Google Maps. */
export function coordenadasValidas(
  sucursal: SucursalMapaDTO,
): CoordenadasMapa | null {
  const { latitud, longitud } = sucursal;
  if (
    typeof latitud !== 'number' ||
    typeof longitud !== 'number' ||
    !Number.isFinite(latitud) ||
    !Number.isFinite(longitud) ||
    latitud < -90 ||
    latitud > 90 ||
    longitud < -180 ||
    longitud > 180
  ) {
    return null;
  }
  return { lat: latitud, lng: longitud };
}

/** Reproduce los criterios del listado: ID exacto para términos numéricos. */
export function coincideNombre(
  sucursal: SucursalMapaDTO,
  termino: string | null | undefined,
): boolean {
  const busqueda = normalizarTerminoBusqueda(termino);
  if (!busqueda) {
    return true;
  }
  if (esTerminoNumerico(busqueda)) {
    return String(sucursal.id) === busqueda;
  }
  const nombre = claveComparacionBusqueda(sucursal.nombre);
  return nombre.includes(claveComparacionBusqueda(busqueda));
}

/** Los filtros del mapa son propios: no leen ni escriben el estado del listado. */
export function filtrarSucursalesMapa(
  sucursales: readonly SucursalMapaDTO[],
  termino: string | null | undefined,
  categoria: string | null,
): SucursalMapaDTO[] {
  return sucursales.filter(
    (sucursal) =>
      coincideNombre(sucursal, termino) &&
      (!categoria || sucursal.categoria === categoria),
  );
}

/**
 * Enlace público de Google Maps: no usa API key, Places, Geocoding ni
 * Directions API. El destino son únicamente las coordenadas persistidas.
 */
export function urlCómoLlegar(coordenadas: CoordenadasMapa): string {
  const url = new URL('https://www.google.com/maps/dir/');
  url.searchParams.set('api', '1');
  url.searchParams.set(
    'destination',
    `${coordenadas.lat},${coordenadas.lng}`,
  );
  return url.toString();
}

/** Mismo formato que usa el listado tradicional para las etiquetas de categoría. */
export function humanizarCategoria(categoria: string | null | undefined): string {
  if (!categoria) {
    return '';
  }
  return categoria
    .replace(/_/g, ' ')
    .toLocaleLowerCase('es')
    .replace(/\b\w/g, (caracter) => caracter.toLocaleUpperCase('es'));
}
