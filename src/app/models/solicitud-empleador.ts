import type { VistaPreviaDTO } from './paginacion';

/** Estados reales expuestos por el backend (`EstadoSolicitud`). */
export type EstadoSolicitudEmpleador = 'PENDIENTE' | 'APROBADA' | 'RECHAZADA';

/** Tamaño fijo de página del listado administrativo (lo valida el backend). */
export const TAMANO_PAGINA_SOLICITUDES = 10;

/**
 * Ubicación elegida en Google Places, con los cuatro valores que espera el
 * endpoint de alta. Se envían siempre completos.
 */
export interface UbicacionSolicitudEmpleadorDTO {
  readonly direccion: string;
  readonly latitud: number;
  readonly longitud: number;
  readonly googlePlaceId: string;
}

/** Ubicación ya persistida, tal como la devuelve el detalle de la solicitud. */
export interface UbicacionGuardadaSolicitudEmpleadorDTO
  extends UbicacionSolicitudEmpleadorDTO {
  readonly id?: number;
}

/**
 * DTO reducido que devuelven `/solicitudes-empleador/propias` y
 * `/solicitudes-empleador/listar`. El listado administrativo paginado también
 * incluye el estado de cada solicitud.
 */
export interface SolicitudEmpleadorMiniDTO {
  readonly id: number;
  readonly nombreUsuario: string;
  readonly apellidoUsuario: string;
  readonly fechaSolicitud: string;
  readonly estado?: EstadoSolicitudEmpleador;
}

export interface UsuarioSolicitudEmpleadorDTO {
  readonly id: number;
  readonly nombre: string;
  readonly apellido: string;
  readonly email: string;
  readonly urlFotoPerfil: string | null;
}

/** Respuesta de `/solicitudes-empleador/{id}/detalles`. */
export interface SolicitudEmpleadorDetalleDTO {
  readonly id: number;
  readonly motivo: string;
  readonly estado: EstadoSolicitudEmpleador;
  readonly fechaSolicitud: string;
  readonly usuario: UsuarioSolicitudEmpleadorDTO;
  /** Vacío en las solicitudes históricas que se crearon sin ubicaciones. */
  readonly ubicaciones?: readonly UbicacionGuardadaSolicitudEmpleadorDTO[];
}

/** Cuerpo de `/solicitudes-empleador/solicitar`. */
export interface SolicitudEmpleadorCrearDTO {
  readonly motivo: string;
  readonly ubicaciones: readonly UbicacionSolicitudEmpleadorDTO[];
}

/** Vista previa de `/solicitudes-empleador/propias`: últimas 3 solicitudes. */
export type VistaPreviaSolicitudesEmpleadorDTO = VistaPreviaDTO<SolicitudEmpleadorMiniDTO>;

/** Contrato de paginación del listado administrativo. */
export interface PaginaSolicitudesEmpleadorDTO {
  readonly content: readonly SolicitudEmpleadorMiniDTO[];
  readonly totalElements: number;
  readonly totalPages: number;
  /** Página devuelta por el backend, comenzando en 0. */
  readonly number: number;
  readonly size: number;
}

export const ETIQUETAS_ESTADO_SOLICITUD: Readonly<Record<EstadoSolicitudEmpleador, string>> = {
  PENDIENTE: 'Pendiente',
  APROBADA: 'Aprobada',
  RECHAZADA: 'Rechazada',
};

export function etiquetaEstadoSolicitud(estado: EstadoSolicitudEmpleador | null | undefined): string {
  return estado ? ETIQUETAS_ESTADO_SOLICITUD[estado] : 'Estado a consultar';
}

export function claseEstadoSolicitud(estado: EstadoSolicitudEmpleador | null | undefined): string {
  return estado ? `estado--${estado.toLowerCase()}` : 'estado--desconocido';
}

/**
 * Enlace público de Google Maps construido solo con datos persistidos: no usa
 * API key, Places ni Geocoding. Si faltan las coordenadas o el Place ID, se
 * usa la dirección guardada como último recurso.
 */
export function urlGoogleMapsUbicacion(
  ubicacion: UbicacionGuardadaSolicitudEmpleadorDTO | null | undefined,
): string | null {
  if (!ubicacion) return null;

  const url = new URL('https://www.google.com/maps/search/');
  url.searchParams.set('api', '1');

  const latitud = ubicacion.latitud;
  const longitud = ubicacion.longitud;
  const placeId = ubicacion.googlePlaceId?.trim() ?? '';
  const coordenadasValidas =
    typeof latitud === 'number' &&
    typeof longitud === 'number' &&
    Number.isFinite(latitud) &&
    Number.isFinite(longitud) &&
    latitud >= -90 &&
    latitud <= 90 &&
    longitud >= -180 &&
    longitud <= 180;

  if (coordenadasValidas && placeId) {
    url.searchParams.set('query', `${latitud},${longitud}`);
    url.searchParams.set('query_place_id', placeId);
    return url.toString();
  }

  const direccion = ubicacion.direccion?.trim();
  if (direccion) {
    url.searchParams.set('query', direccion);
    return url.toString();
  }

  return null;
}

/** Códigos postales argentinos al inicio: B7600GWE, B7600, 7600 o CP 7600. */
const CODIGO_POSTAL_ALFANUMERICO = /^(?:CP\.?\s*)?[A-Za-z]\d{4}(?:[A-Za-z]{2,3})?(?:\s+|$)/i;
const CODIGO_POSTAL_NUMERICO = /^(?:CP\.?\s*)?\d{4}(?:-\d{4})?(?:\s+|$)/;
const SEGMENTO_ADMINISTRATIVO =
  /^(?:provincia(?:\s+de)?|departamento|estado(?:\s+de)?|state(?:\s+of)?|regi[oó]n|region|comunidad(?:\s+de)?|distrito|municipio|condado|county)\b/i;
const SEGMENTO_ESTADO_POSTAL = /^[A-Z]{2}\s+\d{4,5}(?:-\d{4})?$/i;
const PAISES_COMUNES =
  /^(?:argentina|usa|estados unidos|united states|canad[aá]|chile|m[eé]xico|mexico|brasil|brazil|uruguay|paraguay|bolivia|per[uú]|peru|colombia|venezuela|ecuador|espa[nñ]a|spain|portugal|francia|france|alemania|germany|italia|italy|reino unido|united kingdom|uk|pa[ií]ses bajos|netherlands|suiza|switzerland)\b/i;
const PREFIJO_CALLE =
  /^(?:av|avenida|calle|ruta|rp|rn|autopista|boulevard|blvd|paseo|pasaje|camino|plaza|parque|circunvalaci[oó]n)\b\.?/i;

function normalizarSegmento(valor: string): string {
  return valor.replace(/\s+/g, ' ').trim();
}

/**
 * Quita solo un código postal al inicio del texto. En la calle se omite el
 * numérico porque puede ser la altura; en la localidad se quitan ambos.
 * El resto del nombre se conserva tal cual.
 */
export function sinCodigoPostal(valor: string, soloAlfanumerico = false): string {
  const texto = normalizarSegmento(valor);
  const sinAlfanumerico = texto.replace(CODIGO_POSTAL_ALFANUMERICO, '');
  return normalizarSegmento(
    soloAlfanumerico ? sinAlfanumerico : sinAlfanumerico.replace(CODIGO_POSTAL_NUMERICO, ''),
  );
}

function esSegmentoAdministrativo(segmento: string): boolean {
  return (
    SEGMENTO_ADMINISTRATIVO.test(segmento) ||
    SEGMENTO_ESTADO_POSTAL.test(segmento) ||
    PAISES_COMUNES.test(segmento)
  );
}

/** Acepta nombres de calle con o sin tipo explícito y alturas compuestas. */
function pareceCalle(segmento: string): boolean {
  return PREFIJO_CALLE.test(segmento) || /\d/.test(segmento);
}

/**
 * Presentación resumida de una dirección ya guardada: calle, altura y localidad.
 * Solo formatea el texto persistido; no consulta Places y no altera el DTO.
 * Descarta nombres de establecimiento, códigos postales, provincias y países.
 * Si no puede identificar la calle con seguridad, devuelve la dirección
 * original antes que quitar información válida.
 */
export function resumirDireccionSolicitudEmpleador(
  direccion: string | null | undefined,
): string {
  const valor = typeof direccion === 'string' ? normalizarSegmento(direccion) : '';
  if (!valor) return '';

  const segmentos = valor.split(',').map(normalizarSegmento).filter(Boolean);
  const primero = segmentos[0] ?? '';
  const segundo = segmentos[1] ?? '';

  // `GTC, Av. Pedro Luro 2335, ...`: el primer segmento no es una calle y el
  // siguiente sí, así que se trata del nombre del establecimiento.
  const indiceCalle =
    !pareceCalle(primero) && pareceCalle(segundo) && !esSegmentoAdministrativo(primero) ? 1 : 0;

  // En la calle solo se quita un código postal alfanumérico (por ejemplo
  // `B7600GWE`): un número de 4 dígitos puede ser la altura de la calle.
  const calle = sinCodigoPostal(segmentos[indiceCalle] ?? '', true);
  const calleConfiable = calle && pareceCalle(calle) && !esSegmentoAdministrativo(calle) ? calle : '';
  if (!calleConfiable) return valor;

  const localidad =
    segmentos
      .slice(indiceCalle + 1)
      .map((segmento) => sinCodigoPostal(segmento))
      .find((segmento) => segmento && !esSegmentoAdministrativo(segmento)) ?? '';

  return localidad ? `${calleConfiable}, ${localidad}` : calleConfiable;
}

/** Ubicación con la presentación opcional calculada al elegir en Places. */
export interface UbicacionConPresentacion {
  readonly direccion: string;
  readonly direccionCorta?: string | null;
}

/**
 * Texto visible de una ubicación. Prefiere los componentes estructurados de
 * Places; para lo ya persistido usa el resumen conservador de la dirección.
 * Nunca modifica los datos que se envían ni los enlaces de Maps.
 */
export function direccionVisibleUbicacion(
  ubicacion: UbicacionConPresentacion,
): string {
  return (
    ubicacion.direccionCorta?.trim() ||
    resumirDireccionSolicitudEmpleador(ubicacion.direccion) ||
    'Dirección no disponible'
  );
}

/** Las fechas del backend son LocalDate (`YYYY-MM-DD`), sin hora ni zona. */
export function formatearFechaSolicitud(fecha: string | null | undefined): string {
  const valor = fecha?.trim();
  if (!valor) return 'Fecha sin informar';

  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  if (!partes) return valor;

  const [, anio, mes, dia] = partes;
  const fechaLocal = new Date(Number(anio), Number(mes) - 1, Number(dia));

  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(fechaLocal);
}

export function inicialesSolicitante(nombre: string, apellido: string): string {
  return `${nombre.trim().charAt(0)}${apellido.trim().charAt(0)}`.toUpperCase() || 'AM';
}
