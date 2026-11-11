type ContextoSolicitud = 'carga' | 'detalle' | 'envio' | 'resolucion';

interface ErrorConRespuesta {
  readonly status?: number;
  readonly error?: unknown;
}

/**
 * Extrae el mensaje seguro que envía el backend para un error de solicitudes.
 * El backend devuelve textos planos o `{ campo: "mensaje" }` en los 400.
 */
function textoDelBackend(cuerpo: unknown): string | null {
  if (typeof cuerpo === 'string') {
    return cuerpo.trim() || null;
  }

  if (cuerpo && typeof cuerpo === 'object') {
    for (const valor of Object.values(cuerpo as Record<string, unknown>)) {
      if (typeof valor === 'string' && valor.trim()) {
        return valor.trim();
      }
    }
  }

  return null;
}

export function mensajeErrorSolicitud(error: unknown, contexto: ContextoSolicitud): string {
  const respuesta = (error ?? {}) as ErrorConRespuesta;
  const status = respuesta.status ?? 0;
  const mensajeBackend = textoDelBackend(respuesta.error);

  if (status === 0) {
    return 'No pudimos conectarnos. Revisá tu conexión e intentá nuevamente.';
  }

  if (status === 401) {
    return 'Tu sesión expiró. Iniciá sesión para continuar.';
  }

  if (status === 403) {
    return mensajeBackend ?? 'No tenés permisos para realizar esta acción.';
  }

  if (status === 404) {
    return mensajeBackend ?? 'No encontramos la solicitud que buscabas.';
  }

  if (status === 409) {
    return mensajeBackend ?? 'La operación no se pudo completar porque la solicitud cambió de estado.';
  }

  if (status === 400 || status === 422) {
    if (contexto === 'envio') {
      return mensajeBackend ?? 'Revisá el comentario ingresado e intentá nuevamente.';
    }
    return mensajeBackend ?? 'Revisá los datos e intentá nuevamente.';
  }

  if (contexto === 'carga') {
    return 'No pudimos cargar tus solicitudes. Intentá nuevamente en unos momentos.';
  }

  if (contexto === 'detalle') {
    return 'No pudimos cargar el detalle de la solicitud. Intentá nuevamente.';
  }

  if (contexto === 'resolucion') {
    return 'No pudimos resolver la solicitud. Intentá nuevamente en unos momentos.';
  }

  return 'No pudimos enviar la solicitud. Intentá nuevamente en unos momentos.';
}
