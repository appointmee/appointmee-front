/**
 * Traducción de las respuestas de error del backend a los mensajes que
 * muestran los formularios de servicios (crear y modificar).
 *
 * El backend de servicios responde los errores de validación con un mapa
 * plano `{ campo: mensaje }` y los errores de negocio con texto plano, por lo
 * que el cuerpo puede llegar como texto o como JSON.
 */

/** Campos del formulario de servicio que muestran su propio error debajo del control. */
export const CAMPOS_SERVICIO = ['nombre', 'descripcion', 'duracion', 'precio', 'foto'] as const;

export interface ErroresFormulario {
  /** Mensaje por campo, listo para pintarse debajo del control. */
  readonly campos: Record<string, string>;
  /** Mensaje general para el banner superior del formulario. */
  readonly general: string | null;
}

/**
 * El endpoint responde con texto plano, así que un error de validación del
 * backend puede llegar como un JSON serializado. Se interpreta para poder
 * mapear cada mensaje a su campo.
 */
export function cuerpoDelError(body: unknown): unknown {
  if (typeof body !== 'string') return body;
  const texto = body.trim();
  if (!texto.startsWith('{') && !texto.startsWith('[')) return body;
  try {
    return JSON.parse(texto) as unknown;
  } catch {
    return body;
  }
}

/** Traduce la clave de un campo del backend al nombre del control del formulario. */
function normalizarCampo(campo: string): string {
  const clave = campo.toLowerCase();
  if (clave.includes('nombre')) return 'nombre';
  if (clave.includes('desc')) return 'descripcion';
  if (clave.includes('dur')) return 'duracion';
  if (clave.includes('prec')) return 'precio';
  if (clave.includes('foto')) return 'foto';
  return campo;
}

/**
 * Separa los errores del backend en los que corresponden a un campo del
 * formulario y los que deben mostrarse en el banner general.
 *
 * `mensajePorEstado` aporta el mensaje propio para los fallos que el backend
 * no explica (red caída, error del servidor, permisos).
 */
export function mapearErroresFormulario(
  err: unknown,
  mensajePorEstado: (status: number) => string,
): ErroresFormulario {
  const error = err as { status?: number; error?: unknown; fields?: unknown } | null;
  const backendErrors: Record<string, string> = {};
  let general: string | null = null;
  const status = Number(error?.status ?? 0);

  const body = cuerpoDelError(error?.error);
  if (error?.fields && typeof error.fields === 'object') {
    Object.assign(backendErrors, error.fields as Record<string, string>);
  }

  if (body && typeof body === 'object') {
    const registro = body as Record<string, unknown>;
    if (registro['fields'] && typeof registro['fields'] === 'object') {
      Object.assign(backendErrors, registro['fields'] as Record<string, string>);
    }

    const propiedades = registro['properties'] as Record<string, unknown> | undefined;
    const lista = Array.isArray(propiedades?.['errors'])
      ? (propiedades?.['errors'] as unknown[])
      : Array.isArray(registro['errors'])
        ? (registro['errors'] as unknown[])
        : null;
    if (Array.isArray(lista)) {
      for (const item of lista) {
        const detalle = (item ?? {}) as Record<string, unknown>;
        const campo = String(detalle['field'] ?? detalle['propertyPath'] ?? detalle['name'] ?? '').trim();
        const mensaje = String(
          detalle['message'] ?? detalle['defaultMessage'] ?? 'Revisá este campo.',
        ).trim();
        if (campo) backendErrors[campo] = mensaje;
      }
    }

    for (const key of Object.keys(registro)) {
      if (
        [
          'message',
          'error',
          'status',
          'timestamp',
          'path',
          'title',
          'detail',
          'type',
          'instance',
          'properties',
          'fields',
        ].includes(key)
      ) {
        continue;
      }
      if (typeof registro[key] === 'string') {
        backendErrors[key] = registro[key] as string;
      }
    }

    if (typeof registro['message'] === 'string' && registro['message'].trim()) {
      general = registro['message'];
    } else if (typeof registro['detail'] === 'string' && registro['detail'].trim()) {
      general = registro['detail'];
    }
  } else if (typeof body === 'string' && body.trim()) {
    general = body;
  }

  const campos: Record<string, string> = {};
  if (Object.keys(backendErrors).length) {
    const mensajesGenerales: string[] = [];
    for (const [campo, mensaje] of Object.entries(backendErrors)) {
      const clave = normalizarCampo(campo);
      if ((CAMPOS_SERVICIO as readonly string[]).includes(clave)) {
        campos[clave] = mensaje;
      } else {
        // No hay campo en el formulario que lo muestre: va al banner general.
        mensajesGenerales.push(`${campo}: ${mensaje}`);
      }
    }
    if (mensajesGenerales.length) {
      general = mensajesGenerales.join(' · ');
    }
    if (!general) {
      general = 'Revisá los campos marcados e intentá nuevamente.';
    }
  }

  // El mensaje del backend solo se muestra cuando explica una regla del
  // negocio (4xx). Para fallas del servidor o de red se usa un mensaje propio
  // que no expone detalles internos.
  if (general && !(status >= 400 && status < 500)) {
    general = null;
  }

  if (!general) {
    general = mensajePorEstado(status);
  }

  return { campos, general };
}
