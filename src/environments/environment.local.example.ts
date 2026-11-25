/**
 * Ejemplo sin secretos: copiar a `environment.local.ts` y reemplazar el valor.
 *
 * `environment.local.ts` está ignorado por Git. El marcador de este ejemplo no
 * es una clave válida y el cargador lo rechaza explícitamente.
 */
export const environment = {
  googleMaps: {
    apiKey: 'REEMPLAZAR_CON_API_KEY_DE_GOOGLE',
  },
};
