import { TestBed } from '@angular/core/testing';

import { GoogleMapsNamespace, googleMapsService } from './google-maps-service';
import { googlePlacesService } from './google-places-service';

interface SolicitudSugerencias {
  input: string;
  sessionToken: unknown;
  includedPrimaryTypes: readonly string[];
}

interface SolicitudCampos {
  fields: readonly string[];
}

class TokenFalso {}

class LugarFalso {
  static solicitudes: SolicitudCampos[] = [];
  static lugar: {
    id?: string;
    formattedAddress?: string;
    location?: { lat(): number; lng(): number };
  } = {
    id: 'ChIJ_uno',
    formattedAddress: 'Av. Corrientes 1234, CABA, Argentina',
    location: { lat: () => -34.6037, lng: () => -58.3816 },
  };

  async fetchFields(opciones: SolicitudCampos): Promise<{ place: typeof LugarFalso.lugar }> {
    LugarFalso.solicitudes.push(opciones);
    return { place: LugarFalso.lugar };
  }
}

class PrediccionFalso {
  static conversiones = 0;

  readonly text: { text: string };

  constructor(
    readonly placeId: string,
    descripcion: string,
  ) {
    this.text = { text: descripcion };
  }

  toPlace(): LugarFalso {
    PrediccionFalso.conversiones += 1;
    return new LugarFalso();
  }
}

class AutocompleteSuggestionFalso {
  static solicitudes: SolicitudSugerencias[] = [];
  static respuesta: (solicitud: SolicitudSugerencias) => Promise<{
    suggestions: { placePrediction?: PrediccionFalso }[];
  }> = async () => ({
    suggestions: [
      {
        placePrediction: new PrediccionFalso(
          'ChIJ_uno',
          'Av. Corrientes 1234, CABA, Argentina',
        ),
      },
      { placePrediction: new PrediccionFalso('', 'sin id') },
      {},
    ],
  });

  static async fetchAutocompleteSuggestions(solicitud: SolicitudSugerencias): Promise<{
    suggestions: { placePrediction?: PrediccionFalso }[];
  }> {
    AutocompleteSuggestionFalso.solicitudes.push(solicitud);
    return AutocompleteSuggestionFalso.respuesta(solicitud);
  }
}

const namespace = {
  maps: {
    places: {
      AutocompleteSuggestion: AutocompleteSuggestionFalso,
      AutocompleteSessionToken: TokenFalso,
    },
  },
} as unknown as GoogleMapsNamespace;

describe('googlePlacesService', () => {
  let servicio: googlePlacesService;
  let cargar: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    AutocompleteSuggestionFalso.solicitudes = [];
    AutocompleteSuggestionFalso.respuesta = async () => ({
      suggestions: [
        {
          placePrediction: new PrediccionFalso(
            'ChIJ_uno',
            'Av. Corrientes 1234, CABA, Argentina',
          ),
        },
        { placePrediction: new PrediccionFalso('', 'sin id') },
        {},
      ],
    });
    LugarFalso.solicitudes = [];
    LugarFalso.lugar = {
      id: 'ChIJ_uno',
      formattedAddress: 'Av. Corrientes 1234, CABA, Argentina',
      location: { lat: () => -34.6037, lng: () => -58.3816 },
    };
    PrediccionFalso.conversiones = 0;

    cargar = vi.fn(async () => namespace);
    TestBed.configureTestingModule({
      providers: [
        {
          provide: googleMapsService,
          useValue: { cargar, estado: () => 'listo', fallo: () => null },
        },
      ],
    });
    servicio = TestBed.inject(googlePlacesService);
  });

  afterEach(() => TestBed.resetTestingModule());

  it('no carga Google al crear el servicio', () => {
    expect(cargar).not.toHaveBeenCalled();
  });

  it('usa el cargador centralizado una sola vez y crea tokens distintos', async () => {
    const token = await servicio.iniciarSesion();
    const otroToken = await servicio.iniciarSesion();

    expect(cargar).toHaveBeenCalledTimes(1);
    expect(token).toBeInstanceOf(TokenFalso);
    expect(otroToken).toBeInstanceOf(TokenFalso);
    expect(otroToken).not.toBe(token);
  });

  it('pide sugerencias de dirección con el token de sesión', async () => {
    const token = await servicio.iniciarSesion();
    const sugerencias = await servicio.buscar('Av. Corrientes 123', token);

    expect(sugerencias).toEqual([
      { id: 'ChIJ_uno', descripcion: 'Av. Corrientes 1234, CABA, Argentina' },
    ]);
    expect(AutocompleteSuggestionFalso.solicitudes[0]).toEqual({
      input: 'Av. Corrientes 123',
      sessionToken: token,
      includedPrimaryTypes: ['street_address'],
    });
    expect(PrediccionFalso.conversiones).toBe(0);
    expect(cargar).toHaveBeenCalledTimes(1);
  });

  it('devuelve una lista vacía cuando no hay sugerencias', async () => {
    AutocompleteSuggestionFalso.respuesta = async () => ({ suggestions: [] });
    const token = await servicio.iniciarSesion();

    await expect(servicio.buscar('calle que no existe', token)).resolves.toEqual([]);
  });

  it('informa un error genérico si Autocomplete falla', async () => {
    AutocompleteSuggestionFalso.respuesta = async () => {
      throw new Error('REQUEST_DENIED');
    };
    const token = await servicio.iniciarSesion();

    await expect(servicio.buscar('Av. Corrientes 123', token)).rejects.toThrow(
      'REQUEST_DENIED',
    );
  });

  it('pide detalles solo tras la selección y solo los campos necesarios', async () => {
    const token = await servicio.iniciarSesion();
    await servicio.buscar('Av. Corrientes 123', token);
    expect(LugarFalso.solicitudes).toHaveLength(0);

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
    expect(PrediccionFalso.conversiones).toBe(1);
    expect(LugarFalso.solicitudes[0]?.fields).toEqual(['formattedAddress', 'location']);
  });

  it('rechaza detalles incompletos sin devolver coordenadas parciales', async () => {
    LugarFalso.lugar = {
      id: 'ChIJ_uno',
      formattedAddress: 'Av. Corrientes 1234',
    };
    const token = await servicio.iniciarSesion();
    await servicio.buscar('Av. Corrientes 123', token);

    await expect(
      servicio.obtenerDetalles({ id: 'ChIJ_uno', descripcion: 'Av. Corrientes' }, token),
    ).rejects.toThrow('No pudimos obtener los datos completos');
  });

  it('rechaza coordenadas fuera de rango', async () => {
    LugarFalso.lugar = {
      id: 'ChIJ_uno',
      formattedAddress: 'Av. Corrientes 1234',
      location: { lat: () => 200, lng: () => -58 },
    };
    const token = await servicio.iniciarSesion();
    await servicio.buscar('Av. Corrientes 123', token);

    await expect(
      servicio.obtenerDetalles({ id: 'ChIJ_uno', descripcion: 'Av. Corrientes' }, token),
    ).rejects.toThrow('No pudimos obtener los datos completos');
  });
});
