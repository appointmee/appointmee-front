/**
 * Resumen visual de la dirección de una sucursal.
 *
 * El backend guarda `direccion` como texto libre (US-MAP-04 guarda el
 * `formattedAddress` de Google). Algunas cargas antiguas no tienen localidad,
 * así que la función nunca inventa una: si no reconoce un segmento válido
 * después de la calle, devuelve solo la calle y altura.
 *
 * Regla aplicada a los detalles de sucursal:
 * 1. primer segmento (hasta la primera coma) → calle y altura;
 * 2. siguiente segmento válido → localidad, sin código postal;
 * 3. se descartan provincia, país y referencias de unidad (piso, depto…).
 */

/** Código postal argentino al inicio de un segmento: B7600GWG, 7600GWG o 7600. */
const CODIGO_POSTAL = /^(?:CP\.?\s*)?[A-Za-z]?\d{4}(?:[A-Za-z]{3})?(?:\s+|$)/i;

/** Segmentos que no son una localidad y no deben mostrarse como tal. */
const NO_ES_LOCALIDAD =
  /^(?:provincia(?:\s+de)?|prov\.?|pcia\.?|argentina|piso|depto|departamento|dpto|torre|local|entre|esquina)\b/i;

function limpiar(valor: string): string {
  return valor.replace(/\s+/g, ' ').trim();
}

function sinCodigoPostal(valor: string): string {
  return limpiar(valor.replace(CODIGO_POSTAL, ''));
}

/**
 * Devuelve `calle y altura, localidad` cuando puede identificarla; si no,
 * devuelve solo `calle y altura`. Cadena vacía si no hay dirección.
 */
export function formatearDireccionResumida(
  direccion: string | null | undefined,
): string {
  const texto = limpiar(direccion ?? '');
  if (!texto) {
    return '';
  }

  const segmentos = texto.split(',').map(limpiar).filter(Boolean);
  const calle = segmentos[0];
  const localidad = segmentos
    .slice(1)
    .map(sinCodigoPostal)
    .find((segmento) => segmento && !NO_ES_LOCALIDAD.test(segmento));

  return localidad ? `${calle}, ${localidad}` : calle;
}
