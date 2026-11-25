/**
 * Configuración de producción (valor por defecto).
 *
 * No contiene credenciales. El pipeline debe aportar `environment.local.ts`
 * desde un secreto y compilar con `npm run build:maps`, o sobrescribir este
 * archivo en el workspace sin versionarlo.
 */
export const environment = {
  googleMaps: {
    apiKey: '',
  },
};
