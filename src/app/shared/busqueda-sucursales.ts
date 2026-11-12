/** Reglas compartidas por los buscadores de sucursales (Home, navbar y listado). */
export const MIN_CARACTERES_BUSQUEDA = 2;
export const DEBOUNCE_BUSQUEDA_MS = 350;

/** Recorta extremos y colapsa espacios internos sin alterar mayúsculas ni acentos. */
export function normalizarTerminoBusqueda(valor: string | null | undefined): string {
  return (valor ?? '').trim().replace(/\s+/g, ' ');
}

/**
 * Clave de comparación visual: ignora mayúsculas/minúsculas y acentos.
 * Se usa para no repetir búsquedas equivalentes y para restaurar la URL.
 */
export function claveComparacionBusqueda(valor: string | null | undefined): string {
  return normalizarTerminoBusqueda(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es');
}

/** Un término numérico busca por ID; para nombres se requieren al menos 2 caracteres. */
export function terminoDeBusqueda(valor: string | null | undefined): string {
  const termino = normalizarTerminoBusqueda(valor);
  return /^\d+$/.test(termino) || termino.length >= MIN_CARACTERES_BUSQUEDA ? termino : '';
}
