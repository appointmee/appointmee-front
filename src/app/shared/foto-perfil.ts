export interface FuenteFotoPerfil {
  readonly urlFotoPerfil?: string | null;
  readonly fotoPerfil?: string | null;
  readonly fotoUrl?: string | null;
}

/**
 * Obtiene la URL de fotografía de perfil/imagen desde las propiedades comunes
 * que pueden exponer los distintos DTOs del backend, sin asumir un único nombre
 * de campo. No inventa URLs: solo devuelve valores reales recibidos.
 */
export function fotoPerfilDe(
  fuente: FuenteFotoPerfil | null | undefined,
): string | null {
  if (!fuente) {
    return null;
  }

  const candidatas = [fuente.urlFotoPerfil, fuente.fotoPerfil, fuente.fotoUrl];
  for (const valor of candidatas) {
    if (typeof valor === 'string') {
      const url = valor.trim();
      if (url) {
        return url;
      }
    }
  }

  return null;
}
