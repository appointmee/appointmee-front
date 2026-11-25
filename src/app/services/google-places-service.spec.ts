import { TestBed } from '@angular/core/testing';

import { GoogleMapsNamespace, googleMapsService } from './google-maps-service';
import { googlePlacesService } from './google-places-service';

type RespuestaPredicciones = (
  predicciones: { place_id?: string; description?: string }[] | null,
  estado: string,
) => void;

type RespuestaDetalles = (lugar: Record<string, unknown> | null, estado: string) => void;

interface SolicitudPredicciones {
  input: string;
  sessionToken: unknown;
  types: readonly string[];
}

interface SolicitudDetalles {
  placeId: string;
  fields: readonly string[];
  sessionToken: unknown;
}

class AutocompleteServiceFalso {
  static solicitudes: SolicitudPredicciones[] = [];
  static respuesta: (solicitud: SolicitudPredicciones, respuesta: RespuestaPredicciones) => void =
    (_solicitud, respuesta) =>
      respuesta([{ place_id: 'ChIJ_uno', description: 'Av. Corrientes 1234, CABA, Argentina' }], 'OK');

  getPlacePredictions(solicitud: SolicitudPredicciones, respuesta: RespuestaPredicciones): void {
    AutocompleteServiceFalso.solicitudes.push(solicitud);
    AutocompleteServiceFalso.respuesta(solicitud, respuesta);
  }
}

class TokenFalso {}

class PlacesServiceFalso {
  static solicitudes: SolicitudDetalles[] = [];
  static respuesta: (solicitud: SolicitudDetalles, respuesta: RespuestaDetalles) => void = (
    _solicitud,
    respuesta,
  ) =>
    respuesta(
      {
        formatted_address: 'Av. Corrientes 1234, CABA, Argentina',
        place_id: 'ChIJ_uno',
        geometry: { location: { lat: () => -34.6037, lng: () => -58.3816 } },
      },
      'OK',
    );

  constructor(elemento: HTMLElement) {
    expect(elemento.tagName.toLowerCase()).toBe('div');
    expect(elemento.isConnected).toBe(false);
  }

  getDetails(solicitud: SolicitudDetalles, respuesta: RespuestaDetalles): void {
    PlacesServiceFalso.solicitudes.push(solicitud);
    PlacesServiceFalso.respuesta(solicitud, respuesta);
  }
}

const namespace = {
  maps: {
    places: {
      AutocompleteService: AutocompleteServiceFalso,
      AutocompleteSessionToken: TokenFalso,
      PlacesService: PlacesServiceFalso,
    },
  },
} as unknown as GoogleMapsNamespace;

describe('googlePlacesService', () => {
  let servicio: googlePlacesService;
  let cargar: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    AutocompleteServiceFalso.solicitudes = [];
    PlacesServiceFalso.solicitudes = [];
    AutocompleteServiceFalso.respuesta = (_solicitud, respuesta) =>
      respuesta(
        [
          { place_id: 'ChIJ_uno', description: 'Av. Corrientes 1234, CABA, Argentina' },
          { place_id: '', description: 'sin id' },
        ],
        'OK',
      );
    PlacesServiceFalso.respuesta = (_solicitud, respuesta) =>
      respuesta(
        {
          formatted_address: 'Av. Corrientes 1234, CABA, Argentina',
          place_id: 'ChIJ_uno',
          geometry: { location: { lat: () => -34.6037, lng: () => -58.3816 } },
        },
        'OK',
      );

    cargar = vi.fn(async () => namespace);
    TestBed.configureTestingModule({
      providers: [{ provide: googleMapsService, useValue: { cargar, estado: () => 'listo', fallo: () => null } }],
    });
    servicio = TestBed.inject(googlePlacesService);
  });

  afterEach(() => TestBed.resetTestingModule());

  it('no carga Google al crear el servicio', () => {
    expect(cargar).not.toHaveBeenCalled();
  });

  it('usa el cargador centralizado una sola vez y reutiliza el namespace', async () => {
    const token = await servicio.iniciarSesion();
    const otroToken = await servicio.iniciarSesion();

    expect(cargar).toHaveBeenCalledTimes(1);
    expect(token).toBeInstanceOf(TokenFalso);
    expect(otroToken).toBeInstanceOf(TokenFalso);
    expect(otroToken).not.toBe(token);
  });

  it('pide sugerencias con el token de sesión y solo direcciones', async () => {
    const token = await servicio.iniciarSesion();
    const sugerencias = await servicio.buscar('Av. Corrientes 123', token);

    expect(sugerencias).toEqual([
      { id: 'ChIJ_uno', descripcion: 'Av. Corrientes 1234, CABA, Argentina' },
    ]);
    expect(AutocompleteServiceFalso.solicitudes[0]).toMatchObject({
      input: 'Av. Corrientes 123',
      sessionToken: token,
      types: ['address'],
    });
    expect(cargar).toHaveBeenCalledTimes(1);
  });

  it('considera ZERO_RESULTS como una lista vacía', async () => {
    AutocompleteServiceFalso.respuesta = (_solicitud, respuesta) => respuesta(null, 'ZERO_RESULTS');
    const token = await servicio.iniciarSesion();

    await expect(servicio.buscar('calle que no existe', token)).resolves.toEqual([]);
  });

  it('informa un error genérico si Autocomplete falla', async () => {
    AutocompleteServiceFalso.respuesta = (_solicitud, respuesta) => respuesta(null, 'REQUEST_DENIED');
    const token = await servicio.iniciarSesion();

    await expect(servicio.buscar('Av. Corrientes 123', token)).rejects.toThrow(
      'No pudimos buscar direcciones',
    );
  });

  it('pide detalles solo con los campos necesarios y el token de la sesión', async () => {
    const token = await servicio.iniciarSesion();
    await servicio.buscar('Av. Corrientes 123', token);
    expect(PlacesServiceFalso.solicitudes).toHaveLength(0);

    const ubicacion = await servicio.obtenerDetalles(
      { id: 'ChIJ_uno', descripcion: 'Av. Corrientes 1234, CABA, Argentina' },
      token,
    );

    expect(ubicacion).toEqual({
      direccion: 'Av. Corrientes 1234, CABA, Argentina',
      latitud: -34.6037,
      longitud: -58.3816,
      googlePlaceId: 'ChIJ_uno',
    });
    expect(PlacesServiceFalso.solicitudes[0]?.fields).toEqual([
      'formatted_address',
      'geometry',
      'place_id',
    ]);
    expect(PlacesServiceFalso.solicitudes[0]?.sessionToken).toBe(token);
  });

  it('rechaza detalles incompletos sin devolver coordenadas parciales', async () => {
    PlacesServiceFalso.respuesta = (_solicitud, respuesta) =>
      respuesta({ formatted_address: 'Av. Corrientes 1234', place_id: 'ChIJ_uno' }, 'OK');
    const token = await servicio.iniciarSesion();

    await expect(
      servicio.obtenerDetalles({ id: 'ChIJ_uno', descripcion: 'Av. Corrientes' }, token),
    ).rejects.toThrow('No pudimos obtener los datos completos');
  });

  it('rechaza coordenadas fuera de rango', async () => {
    PlacesServiceFalso.respuesta = (_solicitud, respuesta) =>
      respuesta(
        {
          formatted_address: 'Av. Corrientes 1234',
          place_id: 'ChIJ_uno',
          geometry: { location: { lat: () => 200, lng: () => -58 } },
        },
        'OK',
      );
    const token = await servicio.iniciarSesion();

    await expect(
      servicio.obtenerDetalles({ id: 'ChIJ_uno', descripcion: 'Av. Corrientes' }, token),
    ).rejects.toThrow('No pudimos obtener los datos completos');
  });
});
