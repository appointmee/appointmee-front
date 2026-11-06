import { HttpContextToken } from '@angular/common/http';

/**
 * Marca una petición cuyo error se resuelve en la propia pantalla (por ejemplo
 * con un mensaje inline y su botón "Reintentar"). El interceptor global la deja
 * pasar sin navegar a /error ni abrir el aviso general.
 */
export const SIN_MANEJO_GLOBAL_DE_ERRORES = new HttpContextToken<boolean>(() => false);
