import { TestBed } from '@angular/core/testing';

import {
  ErrorGeolocalizacion,
  GEOLOCALIZACION_NAVEGADOR,
  geolocalizacionService,
} from './geolocalizacion-service';

type ResultadoFalso =
  | { readonly tipo: 'exito'; readonly lat: number; readonly lng: number }
  | { readonly tipo: 'fallo'; readonly code: number };

function apiCon(resultado: ResultadoFalso): Geolocation {
  const getCurrentPosition = vi.fn(
    (exito: PositionCallback, fallo: PositionErrorCallback | null) => {
      if (resultado.tipo === 'exito') {
        exito({
          coords: { latitude: resultado.lat, longitude: resultado.lng },
        } as GeolocationPosition);
        return;
      }
      fallo?.({ code: resultado.code } as GeolocationPositionError);
    },
  );
  return { getCurrentPosition } as unknown as Geolocation;
}

function servicioCon(api: Geolocation | null): geolocalizacionService {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [{ provide: GEOLOCALIZACION_NAVEGADOR, useValue: api }],
  });
  return TestBed.inject(geolocalizacionService);
}

describe('US-MAP-07 · Geolocalización puntual del cliente', () => {

  it('devuelve una sola posición sin watchPosition ni almacenamiento', async () => {
    const api = apiCon({ tipo: 'exito', lat: -34.6, lng: -58.4 });
    const servicio = servicioCon(api);

    await expect(servicio.obtenerPosicion()).resolves.toEqual({
      lat: -34.6,
      lng: -58.4,
    });
    expect(api.getCurrentPosition).toHaveBeenCalledTimes(1);
    expect((api.getCurrentPosition as ReturnType<typeof vi.fn>).mock.calls[0][2]).toMatchObject({
      timeout: 10000,
      maximumAge: 0,
    });
    expect('watchPosition' in api).toBe(false);
  });

  it('rechaza con sin-soporte cuando el navegador no expone la API', async () => {
    await expect(servicioCon(null).obtenerPosicion()).rejects.toMatchObject({
      tipo: 'sin-soporte',
    });
  });

  it('clasifica el permiso denegado, el timeout y el resto de errores', async () => {
    await expect(
      servicioCon(apiCon({ tipo: 'fallo', code: 1 })).obtenerPosicion(),
    ).rejects.toMatchObject({ tipo: 'denegado' });
    await expect(
      servicioCon(apiCon({ tipo: 'fallo', code: 3 })).obtenerPosicion(),
    ).rejects.toMatchObject({ tipo: 'timeout' });
    await expect(
      servicioCon(apiCon({ tipo: 'fallo', code: 2 })).obtenerPosicion(),
    ).rejects.toMatchObject({ tipo: 'error' });
  });

  it('descarta coordenadas fuera de rango o no numéricas', async () => {
    await expect(
      servicioCon(
        apiCon({ tipo: 'exito', lat: Number.NaN, lng: -58.4 }),
      ).obtenerPosicion(),
    ).rejects.toBeInstanceOf(ErrorGeolocalizacion);
    await expect(
      servicioCon(
        apiCon({ tipo: 'exito', lat: 95, lng: -58.4 }),
      ).obtenerPosicion(),
    ).rejects.toMatchObject({ tipo: 'error' });
  });
});
