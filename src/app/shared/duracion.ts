/**
 * Representación de la duración de un servicio.
 *
 * El backend guarda la duración en minutos y solo acepta valores en intervalos
 * de 30 minutos (30, 60, 90, 120…). Estas funciones convierten ese número a
 * texto legible y se reutilizan en el listado, en el detalle del servicio y en
 * el formulario de modificación.
 */

/** Normaliza el valor que llega del backend a minutos enteros, o `null` si no es usable. */
function aMinutos(minutos: number | null | undefined): number | null {
  if (minutos === null || minutos === undefined || !Number.isFinite(minutos) || minutos <= 0) {
    return null;
  }
  return Math.round(minutos);
}

/**
 * Duración expresada en palabras.
 * 30 → "30 minutos", 60 → "1 hora", 90 → "1 hora y 30 minutos", 120 → "2 horas".
 */
export function formatearDuracion(minutos: number | null | undefined): string {
  const total = aMinutos(minutos);
  if (total === null) return 'Duración a confirmar';

  const horas = Math.floor(total / 60);
  const resto = total % 60;
  const partes: string[] = [];

  if (horas > 0) partes.push(`${horas} ${horas === 1 ? 'hora' : 'horas'}`);
  if (resto > 0) partes.push(`${resto} ${resto === 1 ? 'minuto' : 'minutos'}`);

  return partes.length ? partes.join(' y ') : 'Duración a confirmar';
}

/**
 * Duración abreviada para las tarjetas del listado.
 * 30 → "30 min", 60 → "1 h", 90 → "1 h 30 min".
 */
export function formatearDuracionCompacta(minutos: number | null | undefined): string {
  const total = aMinutos(minutos);
  if (total === null) return 'Duración a confirmar';
  if (total < 60) return `${total} min`;

  const horas = Math.floor(total / 60);
  const resto = total % 60;
  return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`;
}
