import { Injectable, InjectionToken, inject } from '@angular/core';

/** Única API del navegador que se consulta: nunca se usa `watchPosition`. */
export const GEOLOCALIZACION_NAVEGADOR = new InjectionToken<Geolocation | null>(
  'GEOLOCALIZACION_NAVEGADOR',
  {
    providedIn: 'root',
    factory: () => globalThis.navigator?.geolocation ?? null,
  },
);

export interface PosicionCliente {
  readonly lat: number;
  readonly lng: number;
}

export type FalloGeolocalizacion =
  | 'sin-soporte'
  | 'denegado'
  | 'timeout'
  | 'error';

export class ErrorGeolocalizacion extends Error {
  constructor(readonly tipo: FalloGeolocalizacion) {
    super(`geolocalizacion:${tipo}`);
    this.name = 'ErrorGeolocalizacion';
  }
}

/** Los códigos son los de la especificación de Geolocation API. */
function tipoDesdeCodigo(codigo: number | undefined): FalloGeolocalizacion {
  if (codigo === 1) {
    return 'denegado';
  }
  if (codigo === 3) {
    return 'timeout';
  }
  return 'error';
}

/**
 * Obtiene una única posición del navegador. No guarda, envía ni registra
 * coordenadas: solo las devuelve al solicitante para dibujar el marcador.
 */
@Injectable({ providedIn: 'root' })
export class geolocalizacionService {
  private readonly navegador = inject(GEOLOCALIZACION_NAVEGADOR);

  obtenerPosicion(
    opciones: PositionOptions = {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 0,
    },
  ): Promise<PosicionCliente> {
    const api = this.navegador;
    if (!api || typeof api.getCurrentPosition !== 'function') {
      return Promise.reject(new ErrorGeolocalizacion('sin-soporte'));
    }

    return new Promise<PosicionCliente>((resolve, reject) => {
      api.getCurrentPosition(
        (posicion) => {
          const lat = posicion?.coords?.latitude;
          const lng = posicion?.coords?.longitude;
          if (
            typeof lat !== 'number' ||
            typeof lng !== 'number' ||
            !Number.isFinite(lat) ||
            !Number.isFinite(lng) ||
            Math.abs(lat) > 90 ||
            Math.abs(lng) > 180
          ) {
            reject(new ErrorGeolocalizacion('error'));
            return;
          }
          resolve({ lat, lng });
        },
        (error) =>
          reject(new ErrorGeolocalizacion(tipoDesdeCodigo(error?.code))),
        opciones,
      );
    });
  }
}
