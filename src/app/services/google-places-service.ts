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

/**
 * Resultado de Places con la presentación corta ya calculada. `direccion`
 * sigue siendo el `formattedAddress` original: es lo que se persiste y lo que
 * usan los enlaces de Maps. `direccionCorta` es solo visual y no se envía.
 */
export interface DetalleUbicacionDireccion extends UbicacionDireccion {
  readonly direccionCorta?: string;
}

/** Componente estructurado de Places (New y formato legacy). */
export interface ComponenteDireccionGoogle {
  readonly types?: readonly string[];
  readonly text?: string;
  readonly long_name?: string;
  readonly short_name?: string;
}

interface FormatoTextoGoogle {
  readonly text?: string;
}

interface PrediccionGoogle {
  readonly placeId?: string;
  readonly text?: string | FormatoTextoGoogle;
  toPlace(): LugarGoogle;
}

interface SugerenciaGoogle {
  readonly placePrediction?: PrediccionGoogle;
}

interface ServicioAutocompletadoGoogle {
  fetchAutocompleteSuggestions(solicitud: {
    input: string;
    sessionToken: unknown;
    includedPrimaryTypes: readonly string[];
  }): Promise<{ suggestions: readonly SugerenciaGoogle[] }>;
}

interface UbicacionGoogle {
  lat(): number;
  lng(): number;
}

interface LugarGoogle {
  readonly id?: string;
  readonly formattedAddress?: string;
  readonly location?: UbicacionGoogle;
  readonly addressComponents?: readonly ComponenteDireccionGoogle[];
  readonly address_components?: readonly ComponenteDireccionGoogle[];
  fetchFields(opciones: { fields: readonly string[] }): Promise<{ place: LugarGoogle }>;
}

/**
 * Tipado mínimo de Places (New). No incorpora el paquete de tipos oficial: el
 * cargador de US-MAP-03 ya expone el namespace global.
 */
interface NamespacePlaces extends GoogleMapsNamespace {
  readonly maps: {
    readonly places: Record<string, unknown> & {
      readonly AutocompleteSuggestion: {
        readonly fetchAutocompleteSuggestions: ServicioAutocompletadoGoogle['fetchAutocompleteSuggestions'];
      };
      readonly AutocompleteSessionToken: new () => unknown;
    };
    readonly [propiedad: string]: unknown;
  };
}

/** Solo se piden los campos necesarios: persistencia, coordenadas y presentación. */
const CAMPOS_DETALLE = ['formattedAddress', 'location', 'addressComponents'] as const;
const TIPOS_DIRECCION = ['street_address'] as const;

function textoComponente(componente: ComponenteDireccionGoogle | undefined): string {
  return (componente?.text ?? componente?.long_name ?? componente?.short_name ?? '').trim();
}

/**
 * Arma `calle altura, ciudad` desde los componentes de Places, sin geocodificar
 * ni consultar de nuevo. Si falta la calle o la ciudad no inventa datos: se
 * usa la dirección guardada como presentación de respaldo.
 */
export function direccionCortaDeComponentes(
  componentes: readonly ComponenteDireccionGoogle[] | null | undefined,
): string | null {
  if (!Array.isArray(componentes)) return null;

  const buscar = (tipos: readonly string[]) =>
    componentes.find((componente: ComponenteDireccionGoogle) =>
      componente.types?.some((tipo: string) => tipos.includes(tipo)),
    );

  const calle = textoComponente(buscar(['route']));
  const altura = textoComponente(buscar(['street_number']));
  // `postal_town` es el equivalente de `locality` en algunas regiones.
  const ciudad = textoComponente(buscar(['locality', 'postal_town']));

  if (!calle || !ciudad) return null;
  return `${altura ? `${calle} ${altura}` : calle}, ${ciudad}`;
}
const MENSAJE_NO_DISPONIBLE = 'Google Places no está disponible en este navegador.';
const MENSAJE_BUSQUEDA = 'No pudimos buscar direcciones en este momento. Intentá de nuevo.';
const MENSAJE_DETALLE = 'No pudimos obtener los datos completos de la dirección. Intentá de nuevo.';

/**
 * Acceso a Autocomplete (New) y a los detalles de un lugar. La carga de Google
 * sigue siendo responsabilidad del cargador centralizado y solo ocurre cuando
 * alguien pide una sesión: aquí no se carga nada en el arranque.
 *
 * Se abre una sesión por búsqueda y se entrega el token al componente para que
 * lo reutilice al pedir los detalles de la sugerencia elegida. Con Places (New),
 * el token viaja automáticamente en el primer `fetchFields` del `Place` creado
 * por `PlacePrediction.toPlace()`. Solo se consultan `formattedAddress`,
 * `location` y `addressComponents`, necesarios para persistir y para mostrar
 * la dirección sin hacer consultas adicionales.
 *
 * No se crea un mapa, un marcador ni se pide geolocalización.
 */
@Injectable({ providedIn: 'root' })
export class googlePlacesService {
  private readonly maps = inject(googleMapsService);

  private namespace: NamespacePlaces | null = null;
  private readonly predicciones = new Map<string, PrediccionGoogle>();

  /** Estados del cargador, para informarlos sin repetir lógica de carga. */
  readonly estado = this.maps.estado;
  readonly fallo = this.maps.fallo;

  /** Prepara el namespace una sola vez; no construye servicios con mapa. */
  private async preparar(): Promise<NamespacePlaces> {
    if (this.namespace) return this.namespace;

    const cargado = await this.maps.cargar();
    const places = (cargado as NamespacePlaces).maps?.places;
    if (
      !places ||
      typeof places.AutocompleteSuggestion?.fetchAutocompleteSuggestions !== 'function' ||
      typeof places.AutocompleteSessionToken !== 'function'
    ) {
      throw new Error(MENSAJE_NO_DISPONIBLE);
    }

    this.namespace = cargado as NamespacePlaces;
    return this.namespace;
  }

  /** Inicia una sesión de Autocomplete. Debe reutilizarse en los detalles. */
  async iniciarSesion(): Promise<unknown> {
    const namespace = await this.preparar();
    return new namespace.maps.places.AutocompleteSessionToken();
  }

  /** Pide sugerencias de direcciones con el token de la sesión en curso. */
  async buscar(texto: string, sessionToken: unknown): Promise<SugerenciaDireccion[]> {
    const namespace = await this.preparar();
    if (!sessionToken) throw new Error(MENSAJE_NO_DISPONIBLE);
    if (!this.namespace) return [];

    try {
      const respuesta =
        await namespace.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: texto,
          sessionToken,
          includedPrimaryTypes: TIPOS_DIRECCION,
        });

      this.predicciones.clear();
      const encontradas: SugerenciaDireccion[] = [];
      for (const sugerencia of respuesta.suggestions ?? []) {
        const prediccion = sugerencia.placePrediction;
        const id = prediccion?.placeId?.trim() ?? '';
        const textoPrediccion = prediccion?.text;
        const descripcion =
          (typeof textoPrediccion === 'string'
            ? textoPrediccion
            : textoPrediccion?.text ?? ''
          ).trim() ?? '';
        if (!id || !descripcion) continue;

        this.predicciones.set(id, prediccion!);
        encontradas.push({ id, descripcion });
      }
      return encontradas;
    } catch (error) {
      this.predicciones.clear();
      throw error instanceof Error ? error : new Error(MENSAJE_BUSQUEDA);
    }
  }

  /**
   * Pide los detalles recién después de que el usuario elige una sugerencia.
   * Si falta alguno de los tres valores, falla en lugar de devolver datos
   * parciales que luego se guardarían con una dirección distinta.
   */
  async obtenerDetalles(
    sugerencia: SugerenciaDireccion,
    sessionToken: unknown,
  ): Promise<DetalleUbicacionDireccion> {
    await this.preparar();
    if (!sessionToken) throw new Error(MENSAJE_NO_DISPONIBLE);

    const prediccion = this.predicciones.get(sugerencia.id);
    if (!prediccion) throw new Error(MENSAJE_DETALLE);

    try {
      const lugar = prediccion.toPlace();
      const { place } = await lugar.fetchFields({ fields: CAMPOS_DETALLE });

      const latitud = place.location?.lat();
      const longitud = place.location?.lng();
      const direccion = place.formattedAddress?.trim() ?? '';
      const googlePlaceId = (place.id ?? sugerencia.id).trim();

      if (
        !direccion ||
        !googlePlaceId ||
        googlePlaceId.length > 255 ||
        typeof latitud !== 'number' ||
        typeof longitud !== 'number' ||
        !Number.isFinite(latitud) ||
        !Number.isFinite(longitud) ||
        latitud < -90 ||
        latitud > 90 ||
        longitud < -180 ||
        longitud > 180
      ) {
        throw new Error(MENSAJE_DETALLE);
      }

      const direccionCorta = direccionCortaDeComponentes(
        place.addressComponents ?? place.address_components ?? null,
      );

      return {
        direccion,
        latitud,
        longitud,
        googlePlaceId,
        ...(direccionCorta ? { direccionCorta } : {}),
      };
    } catch (error) {
      throw error instanceof Error ? error : new Error(MENSAJE_DETALLE);
    }
  }
}
