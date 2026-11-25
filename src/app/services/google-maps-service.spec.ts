import { TestBed } from '@angular/core/testing';
import {
  GOOGLE_MAPS_CONFIG,
  GoogleMapsNamespace,
  googleMapsService,
} from './google-maps-service';

const CLAVE_DE_PRUEBA = 'clave-de-prueba-no-valida';
const MARCADOR_SCRIPT = 'script[data-appointmee-google-maps]';
const namespaceFalso = { maps: { places: {} } } as unknown as GoogleMapsNamespace;

function configurar(apiKey: string): googleMapsService {
  TestBed.configureTestingModule({
    providers: [{ provide: GOOGLE_MAPS_CONFIG, useValue: { apiKey } }],
  });
  return TestBed.inject(googleMapsService);
}

function scriptsDeGoogle(): HTMLScriptElement[] {
  return Array.from(document.querySelectorAll<HTMLScriptElement>(MARCADOR_SCRIPT));
}

function callbackDelScript(script: HTMLScriptElement): {
  nombre: string;
  ejecutar: () => void;
} {
  const nombre = new URL(script.src, window.location.href).searchParams.get('callback');
  expect(nombre).toBeTruthy();

  const callback = (window as unknown as Record<string, unknown>)[nombre!];
  expect(typeof callback).toBe('function');

  return { nombre: nombre!, ejecutar: () => (callback as () => void)() };
}

function exponerGoogle(): void {
  (window as unknown as { google?: GoogleMapsNamespace }).google = namespaceFalso;
}

describe('googleMapsService', () => {
  afterEach(() => {
    for (const script of scriptsDeGoogle()) script.remove();
    delete (window as unknown as { google?: GoogleMapsNamespace }).google;
    TestBed.resetTestingModule();
  });

  it('no descarga Google Maps al crear el servicio', () => {
    const service = configurar(CLAVE_DE_PRUEBA);

    expect(service.estado()).toBe('sin-configurar');
    expect(scriptsDeGoogle()).toHaveLength(0);
  });

  it('rechaza la carga sin API key y no crea un script', async () => {
    const service = configurar('   ');

    await expect(service.cargar()).rejects.toThrow(/falta la API key/);

    expect(service.fallo()).toBe('sin-api-key');
    expect(scriptsDeGoogle()).toHaveLength(0);
  });

  it('rechaza el marcador del archivo de ejemplo', async () => {
    const service = configurar('REEMPLAZAR_CON_API_KEY_DE_GOOGLE');

    await expect(service.cargar()).rejects.toThrow(/no es válida/);

    expect(service.fallo()).toBe('api-key-invalida');
    expect(scriptsDeGoogle()).toHaveLength(0);
  });

  it('carga la API con Places y resuelve cuando el callback confirma', async () => {
    const service = configurar(CLAVE_DE_PRUEBA);
    const promesa = service.cargar();

    expect(service.estado()).toBe('cargando');
    const scripts = scriptsDeGoogle();
    expect(scripts).toHaveLength(1);

    const parametros = new URL(scripts[0]!.src, window.location.href).searchParams;
    expect(parametros.get('key')).toBe(CLAVE_DE_PRUEBA);
    expect(parametros.get('libraries')).toBe('places');
    expect(parametros.get('loading')).toBe('async');

    const callback = callbackDelScript(scripts[0]!);
    exponerGoogle();
    callback.ejecutar();

    await expect(promesa).resolves.toBe(namespaceFalso);
    expect(service.estado()).toBe('listo');
    expect((window as unknown as Record<string, unknown>)[callback.nombre]).toBeUndefined();
  });

  it('comparte una sola carga entre llamadas concurrentes y posteriores', async () => {
    const service = configurar(CLAVE_DE_PRUEBA);
    const primera = service.cargar();
    const segunda = service.cargar();

    expect(primera).toBe(segunda);
    expect(scriptsDeGoogle()).toHaveLength(1);

    const callback = callbackDelScript(scriptsDeGoogle()[0]!);
    exponerGoogle();
    callback.ejecutar();
    await Promise.all([primera, segunda]);

    await expect(service.cargar()).resolves.toBe(namespaceFalso);
    expect(scriptsDeGoogle()).toHaveLength(1);
  });

  it('no inyecta nada si Google Maps ya está disponible', async () => {
    exponerGoogle();
    const service = configurar(CLAVE_DE_PRUEBA);

    await expect(service.cargar()).resolves.toBe(namespaceFalso);

    expect(scriptsDeGoogle()).toHaveLength(0);
    expect(service.estado()).toBe('listo');
  });

  it('informa el error de carga y permite reintentar sin duplicar el script', async () => {
    const service = configurar(CLAVE_DE_PRUEBA);
    const primera = service.cargar();

    scriptsDeGoogle()[0]!.dispatchEvent(new Event('error'));
    await expect(primera).rejects.toThrow(/No se pudo cargar/);
    expect(service.fallo()).toBe('carga-fallida');
    expect(scriptsDeGoogle()).toHaveLength(0);

    const segunda = service.cargar();
    expect(service.estado()).toBe('cargando');
    expect(scriptsDeGoogle()).toHaveLength(1);

    const callback = callbackDelScript(scriptsDeGoogle()[0]!);
    exponerGoogle();
    callback.ejecutar();

    await expect(segunda).resolves.toBe(namespaceFalso);
    expect(service.estado()).toBe('listo');
    expect(scriptsDeGoogle()).toHaveLength(1);
  });

  it('falla si el script carga pero Google Maps no quedó disponible', async () => {
    const service = configurar(CLAVE_DE_PRUEBA);
    const promesa = service.cargar();

    callbackDelScript(scriptsDeGoogle()[0]!).ejecutar();

    await expect(promesa).rejects.toThrow(/no está disponible/);
    expect(service.fallo()).toBe('google-no-disponible');
    expect(scriptsDeGoogle()).toHaveLength(0);
  });
});
