import { SucursalMiniDTO } from '../../models/sucursal';
import {
  ABREVIATURAS_DIAS,
  DIAS_SUCURSAL,
} from '../../components/sucursal-form/sucursal-form.model';
import {
  MIN_CARACTERES_BUSQUEDA,
  claveComparacionBusqueda,
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

/**
 * El buscador del mapa es propio: compara solo el nombre, nunca el ID.
 * El término se normaliza como en el resto de la app (sin acentos ni mayúsculas).
 */
export function coincideNombre(
  sucursal: SucursalMapaDTO,
  termino: string | null | undefined,
): boolean {
  const busqueda = normalizarTerminoBusqueda(termino);
  if (!busqueda) {
    return true;
  }
  return claveComparacionBusqueda(sucursal.nombre).includes(
    claveComparacionBusqueda(busqueda),
  );
}

/**
 * A diferencia del buscador compartido, los términos numéricos también
 * respetan el mínimo de caracteres: el ID nunca habilita una búsqueda corta.
 */
export function terminoDeBusquedaMapa(
  valor: string | null | undefined,
): string {
  const termino = normalizarTerminoBusqueda(valor);
  return termino.length >= MIN_CARACTERES_BUSQUEDA ? termino : '';
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

/** Valoración válida del DTO, redondeada como en el resto de la aplicación. */
export function puntuacionMapa(
  sucursal: SucursalMapaDTO,
): number | null {
  const valor = sucursal.puntuacion;
  if (
    typeof valor !== 'number' ||
    !Number.isFinite(valor) ||
    valor < 1 ||
    valor > 5
  ) {
    return null;
  }
  return Math.round(valor * 10) / 10;
}

/** Texto que se dibuja dentro de la burbuja; `-` significa "sin puntuaciones". */
export function textoIndicadorMapa(sucursal: SucursalMapaDTO): string {
  return puntuacionMapa(sucursal)?.toString() ?? '-';
}

/** Una abeja por punto de la escala, con el mismo criterio del detalle. */
export function abejasMapa(valor: number | null): readonly boolean[] {
  const redondeado = Math.round(valor ?? 0);
  return [1, 2, 3, 4, 5].map((posicion) => posicion <= redondeado);
}

/** Alias en castellano admitidos por la API, como en el detalle de sucursal. */
const ALIAS_DIAS: Readonly<Record<string, string>> = {
  LUNES: 'MONDAY',
  MARTES: 'TUESDAY',
  MIERCOLES: 'WEDNESDAY',
  'MIÉRCOLES': 'WEDNESDAY',
  JUEVES: 'THURSDAY',
  VIERNES: 'FRIDAY',
  SABADO: 'SATURDAY',
  SÁBADO: 'SATURDAY',
  DOMINGO: 'SUNDAY',
};

export interface DiaMapa {
  readonly dia: string;
  readonly abreviatura: string;
  readonly abierto: boolean;
}

/** Los siete días en orden, marcados solo con los datos reales del DTO. */
export function diasMapa(sucursal: SucursalMapaDTO): readonly DiaMapa[] {
  const abiertos = new Set(
    (sucursal.diasApertura ?? []).map((nombre) => {
      const normalizado = (nombre ?? '').trim().toUpperCase();
      return ALIAS_DIAS[normalizado] ?? normalizado;
    }),
  );

  return DIAS_SUCURSAL.map((dia) => ({
    dia,
    abreviatura: ABREVIATURAS_DIAS[dia] ?? dia,
    abierto: abiertos.has(dia),
  }));
}

function escaparXml(valor: string): string {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function colorToken(valor: string, respaldo: string): string {
  return /^#[0-9a-f]{3,8}$/i.test(valor) ? valor : respaldo;
}

/** Mismo recurso visual que usa AppointMee para las valoraciones. */
export const ABEJA_MAPA = '🐝';

/**
 * Ancho mínimo de la burbuja. Un decimal ocupa tres caracteres, así que se
 * reserva espacio para él y para la abeja; los valores enteros quedan compactos.
 */
function anchoIndicador(texto: string): number {
  const anchoContenido = Array.from(texto).length * 10 + 3 + 17 + 12;
  return Math.max(44, Math.ceil(anchoContenido / 2) * 2);
}

/**
 * Icono SVG embebido (data URI): no descarga imágenes ni consulta ninguna API.
 * Los colores vienen de los tokens `--accent` y `--on-accent` de la app.
 * El ancho se ajusta al contenido para que ningún decimal se corte; número y
 * abeja comparten un único texto centrado.
 */
export function iconoIndicadorMapa(
  texto: string,
  colorAcento: string,
  colorTexto = '#07090d',
): string {
  const fondo = colorToken(colorAcento, '#f7c65a');
  const tinta = colorToken(colorTexto, '#07090d');
  const etiqueta = escaparXml(texto);
  const ancho = anchoIndicador(texto);
  const centro = ancho / 2;
  const mitad = centro - 2;
  const derecha = ancho - 2;
  const curvaIzquierda = centro - mitad * 0.58;
  const curvaDerecha = centro + mitad * 0.58;
  const contenido =
    `<tspan font-weight="700">${etiqueta}</tspan>` +
    `<tspan dx="3" font-size="14" font-weight="400">${ABEJA_MAPA}</tspan>`;
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="56" viewBox="0 0 ${ancho} 56">`,
    `<path d="M${centro} 2C${curvaIzquierda} 2 2 10.4 2 21.5 2 36 ${centro} 54 ${centro} 54s${mitad}-18 ${mitad}-32.5C${derecha} 10.4 ${curvaDerecha} 2 ${centro} 2Z" fill="${fondo}" stroke="${tinta}" stroke-width="2"/>`,
    `<text x="${centro}" y="24" text-anchor="middle" dominant-baseline="middle" fill="${tinta}" font-family="Arial, sans-serif" font-size="16">${contenido}</text>`,
    '</svg>',
  ].join('');

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

/**
 * Indicador del cliente: abeja sobre un círculo azul con una etiqueta "VOS".
 * Su forma, color y tamaño lo diferencian de las burbujas amarillas que
 * muestran la puntuación de cada sucursal.
 */
export function iconoUbicacionClienteMapa(
  colorAcento: string,
  colorTexto: string,
): string {
  const fondo = colorToken(colorAcento, '#5aa0f7');
  const claro = colorToken(colorTexto, '#eef2f7');
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="88" height="88" viewBox="0 0 88 88">',
    `<circle cx="44" cy="39" r="34" fill="none" stroke="${claro}" stroke-width="4"/>`,
    `<circle cx="44" cy="39" r="29" fill="${fondo}"/>`,
    `<text x="44" y="47" text-anchor="middle" dominant-baseline="middle" font-family="Arial, sans-serif" font-size="30">${ABEJA_MAPA}</text>`,
    `<rect x="17" y="65" width="54" height="20" rx="10" fill="${claro}"/>`,
    `<text x="44" y="76" text-anchor="middle" dominant-baseline="middle" fill="${fondo}" font-family="Arial, sans-serif" font-size="12" font-weight="700">VOS</text>`,
    '</svg>',
  ].join('');

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}
