import { HttpErrorResponse } from '@angular/common/http';

/** Compatibilidad con el backend anterior, que devolvía 401 para una contraseña actual incorrecta. */
export function esPasswordActualIncorrecta(error: unknown): boolean {
  if (!(error instanceof HttpErrorResponse) || ![400, 401].includes(error.status)) return false;
  const body = error.error;
  if (body?.code === 'CURRENT_PASSWORD_INVALID') return true;
  const mensaje = typeof body === 'string' ? body : body?.message;
  if (typeof mensaje !== 'string') return false;
  const texto = mensaje.normalize('NFD').replace(/\p{M}/gu, '').trim().replace(/\.$/, '').toLowerCase();
  return ['contrasena actual incorrecta', 'la contrasena actual es incorrecta'].includes(texto);
}
