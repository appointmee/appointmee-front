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

const CODIGO_POSTAL_CON_LETRA = /^[A-Z]\d{4}[A-Z]{2,3}\s+/i;
const CODIGO_POSTAL_NUMERICO = /^\d{4,5}(?:-\d{4})?\s+/;
const SEGMENTO_ADMINISTRATIVO =
  /^(?:provincia(?:\s+de)?|departamento|estado(?:\s+de)?|state(?:\s+of)?|regi[oó]n|region|comunidad(?:\s+de)?|distrito|municipio|condado|county)\b/i;
const SEGMENTO_ESTADO_POSTAL = /^[A-Z]{2}\s+\d{4,5}(?:-\d{4})?$/i;
const PAISES_COMUNES =
  /^(?:argentina|usa|estados unidos|united states|canad[aá]|chile|m[eé]xico|mexico|brasil|brazil|uruguay|paraguay|bolivia|per[uú]|peru|colombia|venezuela|ecuador|espa[nñ]a|spain|portugal|francia|france|alemania|germany|italia|italy|reino unido|united kingdom|uk|pa[ií]ses bajos|netherlands|suiza|switzerland)\b/i;

function normalizarSegmento(valor: string): string {
  return valor.replace(/\s+/g, ' ').trim();
}

function quitarCodigoPostal(segmento: string, soloAlfanumerico: boolean): string {
  const sinAlfanumerico = segmento.replace(CODIGO_POSTAL_CON_LETRA, '').trim();
  return soloAlfanumerico
    ? sinAlfanumerico
    : sinAlfanumerico.replace(CODIGO_POSTAL_NUMERICO, '').trim();
}

function esSegmentoAdministrativo(segmento: string): boolean {
  return (
    SEGMENTO_ADMINISTRATIVO.test(segmento) ||
    SEGMENTO_ESTADO_POSTAL.test(segmento) ||
    PAISES_COMUNES.test(segmento)
  );
}

/**
 * Presentación resumida de una dirección ya guardada: calle, altura y localidad.
 * Solo formatea el texto persistido; no consulta Places y no altera el DTO.
 * Ante un formato no confiable devuelve un texto neutro en lugar de inventar
 * datos o mostrar códigos postales, provincias y países como si fueran locales.
 */
export function resumirDireccionSolicitudEmpleador(
  direccion: string | null | undefined,
): string {
  const valor = typeof direccion === 'string' ? normalizarSegmento(direccion) : '';
  if (!valor) return 'Dirección no disponible';

  const segmentos = valor.split(',').map(normalizarSegmento).filter(Boolean);
  // En la calle solo se quita un código postal alfanumérico (por ejemplo
  // `B7600GWE`): un número de 4 dígitos puede ser la altura de la calle.
  const calle = quitarCodigoPostal(segmentos[0] ?? '', true);
  const calleConfiable = calle && !esSegmentoAdministrativo(calle) ? calle : '';

  const localidad =
    segmentos
      .slice(1)
      .map((segmento) => quitarCodigoPostal(segmento, false))
      .find((segmento) => segmento && !esSegmentoAdministrativo(segmento)) ?? '';

  if (calleConfiable && localidad) return `${calleConfiable}, ${localidad}`;
  if (calleConfiable) return calleConfiable;
  if (localidad) return localidad;
  return 'Dirección no disponible';
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
