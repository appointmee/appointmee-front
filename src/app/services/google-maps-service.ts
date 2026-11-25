import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, InjectionToken, inject, signal } from '@angular/core';
import { environment } from '../../environments/environment';

export interface GoogleMapsConfig {
  readonly apiKey: string;
}

/** La configuración sale de los archivos de entorno; las pruebas pueden superarla. */
export const GOOGLE_MAPS_CONFIG = new InjectionToken<GoogleMapsConfig>('GOOGLE_MAPS_CONFIG', {
  providedIn: 'root',
  factory: () => environment.googleMaps,
});

/** Superficie mínima expuesta a futuras funcionalidades de mapas y Places. */
export interface GoogleMapsNamespace {
  readonly maps: {
    readonly places: Record<string, unknown>;
    readonly [propiedad: string]: unknown;
  };
}

export type GoogleMapsEstado = 'sin-configurar' | 'cargando' | 'listo' | 'error';

export type GoogleMapsFallo =
  | 'sin-api-key'
  | 'api-key-invalida'
  | 'carga-fallida'
  | 'google-no-disponible'
  | 'sin-documento';

const URL_API = 'https://maps.googleapis.com/maps/api/js';
const MARCADOR_SCRIPT = 'appointmeeGoogleMaps';
const EJEMPLO_NO_VALIDO = 'REEMPLAZAR_CON_API_KEY_DE_GOOGLE';
const TIEMPO_ESPERA_MS = 15_000;

const MENSAJES_ERROR: Record<GoogleMapsFallo, string> = {
  'sin-api-key': 'Google Maps no está configurado: falta la API key.',
  'api-key-invalida': 'Google Maps no está configurado: la API key no es válida.',
  'carga-fallida': 'No se pudo cargar Google Maps.',
  'google-no-disponible': 'Google Maps no está disponible en este navegador.',
  'sin-documento': 'Google Maps no puede inicializarse sin un documento.',
};

/**
 * Carga diferida y única del maps JavaScript API con la librería `places`.
 *
 * No hay inicialización en el arranque: solo se ejecuta cuando una
 * funcionalidad llama a `cargar()`. Las llamadas concurrentes comparten la
 * misma promesa y un fallo permite reintentar sin duplicar el script.
 */
@Injectable({ providedIn: 'root' })
export class googleMapsService {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly config = inject(GOOGLE_MAPS_CONFIG);

  private readonly estadoInterno = signal<GoogleMapsEstado>('sin-configurar');
  private readonly falloInterno = signal<GoogleMapsFallo | null>(null);

  private promesa?: Promise<GoogleMapsNamespace>;
  private intento = 0;
  private temporizador: ReturnType<typeof setTimeout> | null = null;
  private globalsActuales: Record<string, unknown> | null = null;
  private callbackActual: string | null = null;
  private scriptActual: HTMLScriptElement | null = null;

  readonly estado = this.estadoInterno.asReadonly();
  readonly fallo = this.falloInterno.asReadonly();

  constructor() {
    this.destroyRef.onDestroy(() => this.limpiarCallback());
  }

  cargar(): Promise<GoogleMapsNamespace> {
    if (this.promesa) return this.promesa;

    const yaCargado = this.namespaceGlobal();
    if (yaCargado) {
      this.estadoInterno.set('listo');
      this.falloInterno.set(null);
      this.promesa = Promise.resolve(yaCargado);
      return this.promesa;
    }

    const configuracion = this.validarConfiguracion();
    if ('fallo' in configuracion) return this.rechazarSinCarga(configuracion.fallo);

    const globals = this.globals();
    if (!globals) return this.rechazarSinCarga('sin-documento');

    this.estadoInterno.set('cargando');
    this.falloInterno.set(null);
    const promesa = this.iniciarCarga(configuracion.clave, globals);
    this.promesa = promesa;
    // Si la carga falla, habilita un nuevo intento sin dejar rejection sin manejar.
    void promesa.catch(() => {
      if (this.promesa === promesa) this.promesa = undefined;
    });
    return promesa;
  }

  private iniciarCarga(
    clave: string,
    globals: Record<string, unknown>,
  ): Promise<GoogleMapsNamespace> {
    this.intento += 1;
    const callback = `__appointmeeGoogleMapsReady${this.intento}`;
    this.globalsActuales = globals;
    this.callbackActual = callback;

    return new Promise<GoogleMapsNamespace>((resolve, reject) => {
      const limpiarCallback = (): void => {
        if (this.temporizador !== null) {
          clearTimeout(this.temporizador);
          this.temporizador = null;
        }
        if (this.globalsActuales && this.callbackActual) {
          delete this.globalsActuales[this.callbackActual];
        }
        this.globalsActuales = null;
        this.callbackActual = null;
      };

      const fallar = (fallo: GoogleMapsFallo): void => {
        limpiarCallback();
        this.scriptActual?.remove();
        this.scriptActual = null;
        this.marcarError(fallo);
        reject(this.crearError(fallo));
      };

      globals[callback] = () => {
        const namespace = this.namespaceGlobal();
        if (!namespace) {
          fallar('google-no-disponible');
          return;
        }

        limpiarCallback();
        this.scriptActual = null;
        this.estadoInterno.set('listo');
        this.falloInterno.set(null);
        resolve(namespace);
      };

      const url = new URL(URL_API);
      url.searchParams.set('key', clave);
      url.searchParams.set('libraries', 'places');
      url.searchParams.set('v', 'weekly');
      url.searchParams.set('loading', 'async');
      url.searchParams.set('callback', callback);

      const script = this.document.createElement('script');
      script.src = url.toString();
      script.async = true;
      script.dataset[MARCADOR_SCRIPT] = 'true';
      script.addEventListener('error', () => fallar('carga-fallida'), { once: true });

      this.temporizador = setTimeout(() => fallar('carga-fallida'), TIEMPO_ESPERA_MS);

      this.scriptActual = script;
      this.document.head.appendChild(script);
    });
  }

  private validarConfiguracion(): { clave: string } | { fallo: GoogleMapsFallo } {
    const valor = this.config.apiKey;
    if (typeof valor !== 'string' || !valor.trim()) return { fallo: 'sin-api-key' };

    const clave = valor.trim();
    if (clave === EJEMPLO_NO_VALIDO || /\s/.test(clave)) {
      return { fallo: 'api-key-invalida' };
    }
    return { clave };
  }

  private globals(): Record<string, unknown> | null {
    const view = this.document.defaultView;
    return view ? (view as unknown as Record<string, unknown>) : null;
  }

  private namespaceGlobal(): GoogleMapsNamespace | null {
    const google = this.globals()?.['google'] as GoogleMapsNamespace | undefined;
    return google?.maps ? google : null;
  }

  private marcarError(fallo: GoogleMapsFallo): void {
    this.estadoInterno.set('error');
    this.falloInterno.set(fallo);
  }

  private rechazarSinCarga(fallo: GoogleMapsFallo): Promise<GoogleMapsNamespace> {
    this.marcarError(fallo);
    const promesa = Promise.resolve().then(() => {
      throw this.crearError(fallo);
    });
    void promesa.catch(() => undefined);
    this.promesa = promesa;
    return promesa;
  }

  private crearError(fallo: GoogleMapsFallo): Error {
    return new Error(MENSAJES_ERROR[fallo]);
  }

  private limpiarCallback(): void {
    if (this.temporizador !== null) clearTimeout(this.temporizador);
    this.temporizador = null;
    if (this.globalsActuales && this.callbackActual) {
      delete this.globalsActuales[this.callbackActual];
    }
    this.globalsActuales = null;
    this.callbackActual = null;
  }
}
