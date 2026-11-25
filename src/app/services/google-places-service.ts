import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

import { GoogleMapsNamespace, googleMapsService } from './google-maps-service';

/** Sugerencia mínima que necesita el selector para pedir los detalles. */
export interface SugerenciaDireccion {
  readonly id: string;
  readonly descripcion: string;
}

/** Datos geográficos que se envían juntos al backend. */
export interface UbicacionDireccion {
  readonly direccion: string;
  readonly latitud: number;
  readonly longitud: number;
  readonly googlePlaceId: string;
}

interface PrediccionGoogle {
  readonly place_id?: string;
  readonly description?: string;
}

interface ServicioAutocompletado {
  getPlacePredictions(
    solicitud: { input: string; sessionToken: unknown; types: readonly string[] },
    respuesta: (predicciones: readonly PrediccionGoogle[] | null, estado: string) => void,
  ): void;
}

interface DetalleGoogle {
  readonly formatted_address?: string;
  readonly place_id?: string;
  readonly geometry?: {
    readonly location?: { lat(): number; lng(): number };
  };
}

interface ServicioLugares {
  getDetails(
    solicitud: { placeId: string; fields: readonly string[]; sessionToken: unknown },
    respuesta: (lugar: DetalleGoogle | null, estado: string) => void,
  ): void;
}

/**
 * Tipado mínimo de la parte de Places que usa esta historia. No incorpora el
 * paquete de tipos oficial: el cargador de US-MAP-03 ya expone el namespace.
 */
interface NamespacePlaces extends GoogleMapsNamespace {
  readonly maps: {
    readonly places: Record<string, unknown> & {
      readonly AutocompleteService: new () => ServicioAutocompletado;
      readonly AutocompleteSessionToken: new () => unknown;
      readonly PlacesService: new (elemento: HTMLElement) => ServicioLugares;
    };
    readonly [propiedad: string]: unknown;
  };
}

const CAMPOS_DETALLE = ['formatted_address', 'geometry', 'place_id'] as const;
const MENSAJE_NO_DISPONIBLE = 'Google Places no está disponible en este navegador.';
const MENSAJE_BUSQUEDA = 'No pudimos buscar direcciones en este momento. Intentá de nuevo.';
const MENSAJE_DETALLE = 'No pudimos obtener los datos completos de la dirección. Intentá de nuevo.';

/**
 * Acceso a Autocomplete (New) y a los detalles de un lugar. La carga de Google
 * sigue siendo responsabilidad del cargador centralizado y solo ocurre cuando
 * alguien pide una sesión: aquí no se carga nada en el arranque.
 *
 * Se pide una sesión por búsqueda y se reutiliza el token para los detalles de
 * la sugerencia elegida. Solo se consultan `formatted_address`, `geometry` y
 * `place_id`, que son los campos que necesita el formulario de sucursal.
 */
@Injectable({ providedIn: 'root' })
export class googlePlacesService {
  private readonly maps = inject(googleMapsService);
  private readonly document = inject(DOCUMENT);

  private namespace: NamespacePlaces | null = null;
  private autocompletado: ServicioAutocompletado | null = null;
  private lugares: ServicioLugares | null = null;

  /** Estados del cargador, para informarlos sin repetir lógica de carga. */
  readonly estado = this.maps.estado;
  readonly fallo = this.maps.fallo;

  /** Prepara el namespace y los servicios una sola vez. */
  private async preparar(): Promise<NamespacePlaces> {
    if (this.namespace) return this.namespace;

    const cargado = await this.maps.cargar();
    const places = (cargado as NamespacePlaces).maps?.places;
    if (
      !places ||
      typeof places['AutocompleteService'] !== 'function' ||
      typeof places['AutocompleteSessionToken'] !== 'function' ||
      typeof places['PlacesService'] !== 'function'
    ) {
      throw new Error(MENSAJE_NO_DISPONIBLE);
    }

    // PlacesService admite un div desconectado: no se crea ni se muestra un mapa.
    this.autocompletado = new places['AutocompleteService']();
    this.lugares = new places['PlacesService'](this.document.createElement('div'));
    this.namespace = cargado as NamespacePlaces;
    return this.namespace;
  }

  /** Inicia una sesión de Autocomplete. Debe reutilizarse en los detalles. */
  async iniciarSesion(): Promise<unknown> {
    const namespace = await this.preparar();
    return new namespace.maps.places['AutocompleteSessionToken']();
  }

  /** Pide sugerencias de direcciones con el token de la sesión en curso. */
  async buscar(texto: string, sessionToken: unknown): Promise<SugerenciaDireccion[]> {
    await this.preparar();
    if (!this.autocompletado) throw new Error(MENSAJE_NO_DISPONIBLE);

    return new Promise<SugerenciaDireccion[]>((resolve, reject) => {
      try {
        this.autocompletado!.getPlacePredictions(
          { input: texto, sessionToken, types: ['address'] },
          (predicciones, estado) => {
            if (estado === 'ZERO_RESULTS') {
              resolve([]);
              return;
            }
            if (estado !== 'OK') {
              reject(new Error(MENSAJE_BUSQUEDA));
              return;
            }
            resolve(
              (predicciones ?? [])
                .filter((prediccion) => !!prediccion.place_id && !!prediccion.description)
                .map((prediccion) => ({
                  id: prediccion.place_id!,
                  descripcion: prediccion.description!,
                })),
            );
          },
        );
      } catch {
        reject(new Error(MENSAJE_BUSQUEDA));
      }
    });
  }

  /**
   * Pide los detalles recién después de que el usuario elige una sugerencia.
   * Si falta alguno de los tres valores, falla en lugar de devolver datos
   * parciales que luego se guardarían con una dirección distinta.
   */
  async obtenerDetalles(
    sugerencia: SugerenciaDireccion,
    sessionToken: unknown,
  ): Promise<UbicacionDireccion> {
    await this.preparar();
    if (!this.lugares) throw new Error(MENSAJE_NO_DISPONIBLE);

    return new Promise<UbicacionDireccion>((resolve, reject) => {
      try {
        this.lugares!.getDetails(
          { placeId: sugerencia.id, fields: CAMPOS_DETALLE, sessionToken },
          (lugar, estado) => {
            if (estado !== 'OK' || !lugar) {
              reject(new Error(MENSAJE_DETALLE));
              return;
            }

            const latitud = lugar.geometry?.location?.lat();
            const longitud = lugar.geometry?.location?.lng();
            const direccion = lugar.formatted_address?.trim() ?? '';
            const googlePlaceId = lugar.place_id?.trim() ?? '';

            if (
              !direccion ||
              !googlePlaceId ||
              typeof latitud !== 'number' ||
              typeof longitud !== 'number' ||
              !Number.isFinite(latitud) ||
              !Number.isFinite(longitud) ||
              latitud < -90 ||
              latitud > 90 ||
              longitud < -180 ||
              longitud > 180
            ) {
              reject(new Error(MENSAJE_DETALLE));
              return;
            }

            resolve({ direccion, latitud, longitud, googlePlaceId });
          },
        );
      } catch {
        reject(new Error(MENSAJE_DETALLE));
      }
    });
  }
}
