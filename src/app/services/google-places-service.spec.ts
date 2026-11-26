import { TestBed } from '@angular/core/testing';

import { GoogleMapsNamespace, googleMapsService } from './google-maps-service';
import {
  ComponenteDireccionGoogle,
  googlePlacesService,
} from './google-places-service';

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
    addressComponents?: readonly ComponenteDireccionGoogle[];
    address_components?: readonly ComponenteDireccionGoogle[];
  } = {
    id: 'ChIJ_uno',
    formattedAddress: 'Av. Corrientes 1234, CABA, Argentina',
    location: { lat: () => -34.6037, lng: () => -58.3816 },
    addressComponents: [
      { types: ['route'], text: 'Av. Corrientes' },
      { types: ['street_number'], text: '1234' },
      { types: ['locality'], text: 'CABA' },
      { types: ['administrative_area_level_1'], text: 'Provincia de Buenos Aires' },
      { types: ['country'], text: 'Argentina' },
    ],
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
      addressComponents: [
        { types: ['route'], text: 'Av. Corrientes' },
        { types: ['street_number'], text: '1234' },
        { types: ['locality'], text: 'CABA' },
      ],
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
      direccionCorta: 'Av. Corrientes 1234, CABA',
    });
    expect(PrediccionFalso.conversiones).toBe(1);
    expect(LugarFalso.solicitudes[0]?.fields).toEqual([
      'formattedAddress',
      'location',
      'addressComponents',
    ]);
  });

  it('usa route, street_number y locality sin depender del formattedAddress', async () => {
    LugarFalso.lugar = {
      ...LugarFalso.lugar,
      formattedAddress:
        'GTC, Av. Pedro Luro 2335, B7600GWE Mar del Plata, Provincia de Buenos Aires, Argentina',
      addressComponents: [
        { types: ['establishment'], text: 'GTC' },
        { types: ['route'], long_name: 'Avenida Pedro Luro' },
        { types: ['street_number'], long_name: '2335' },
        { types: ['locality'], long_name: 'Mar del Plata' },
      ],
    };
    const token = await servicio.iniciarSesion();
    await servicio.buscar('Av. Pedro Luro', token);

    const ubicacion = await servicio.obtenerDetalles(
      { id: 'ChIJ_uno', descripcion: 'Av. Pedro Luro 2335' },
      token,
    );

    expect(ubicacion.direccionCorta).toBe('Avenida Pedro Luro 2335, Mar del Plata');
    expect(ubicacion.direccion).toBe(
      'GTC, Av. Pedro Luro 2335, B7600GWE Mar del Plata, Provincia de Buenos Aires, Argentina',
    );
    expect(LugarFalso.solicitudes).toHaveLength(1);
  });

  it('quita B7600GWE, B7600 y 7600 de la localidad devuelta por Places', async () => {
    const token = await servicio.iniciarSesion();
    await servicio.buscar('Av. Pedro Luro', token);

    for (const ciudad of [
      'B7600GWE Mar del Plata',
      'B7600 Mar del Plata',
      '7600 Mar del Plata',
      'CP B7600GWE Mar del Plata',
    ]) {
      LugarFalso.lugar = {
        ...LugarFalso.lugar,
        formattedAddress: `Av. Pedro Luro 2335, ${ciudad}, Provincia de Buenos Aires, Argentina`,
        addressComponents: [
          { types: ['route'], text: 'Av. Pedro Luro' },
          { types: ['street_number'], text: '2335' },
          { types: ['locality'], text: ciudad },
        ],
      };

      const ubicacion = await servicio.obtenerDetalles(
        { id: 'ChIJ_uno', descripcion: 'Av. Pedro Luro 2335' },
        token,
      );

      expect(ubicacion.direccionCorta).toBe('Av. Pedro Luro 2335, Mar del Plata');
    }
    expect(LugarFalso.solicitudes).toHaveLength(4);
  });

  it('prioriza locality y no modifica localidades legítimas con números', async () => {
    LugarFalso.lugar = {
      ...LugarFalso.lugar,
      addressComponents: [
        { types: ['postal_town'], text: 'B7600 Mar del Plata' },
        { types: ['route'], text: 'Av. Pedro Luro' },
        { types: ['street_number'], text: '2335' },
        { types: ['locality'], text: '9 de Julio' },
      ],
    };
    const token = await servicio.iniciarSesion();
    await servicio.buscar('Av. Pedro Luro', token);

    const ubicacion = await servicio.obtenerDetalles(
      { id: 'ChIJ_uno', descripcion: 'Av. Pedro Luro 2335' },
      token,
    );

    expect(ubicacion.direccionCorta).toBe('Av. Pedro Luro 2335, 9 de Julio');
  });

  it('usa postal_town como alternativa si locality solo trae el código postal', async () => {
    LugarFalso.lugar = {
      ...LugarFalso.lugar,
      addressComponents: [
        { types: ['route'], text: 'Av. Pedro Luro' },
        { types: ['street_number'], text: '2335' },
        { types: ['locality'], text: 'B7600' },
        { types: ['postal_town'], text: 'Mar del Plata' },
      ],
    };
    const token = await servicio.iniciarSesion();
    await servicio.buscar('Av. Pedro Luro', token);

    const ubicacion = await servicio.obtenerDetalles(
      { id: 'ChIJ_uno', descripcion: 'Av. Pedro Luro 2335' },
      token,
    );

    expect(ubicacion.direccionCorta).toBe('Av. Pedro Luro 2335, Mar del Plata');
  });

  it('admite la estructura legacy y postal_town como localidad equivalente', async () => {
    LugarFalso.lugar = {
      ...LugarFalso.lugar,
      addressComponents: undefined,
      address_components: [
        { types: ['route'], long_name: 'Calle 12 de Octubre' },
        { types: ['postal_town'], long_name: 'Bahía Blanca' },
      ],
    };
    const token = await servicio.iniciarSesion();
    await servicio.buscar('12 de Octubre', token);

    const ubicacion = await servicio.obtenerDetalles(
      { id: 'ChIJ_uno', descripcion: 'Calle 12 de Octubre' },
      token,
    );

    expect(ubicacion.direccionCorta).toBe('Calle 12 de Octubre, Bahía Blanca');
  });

  it('omite la presentación corta si faltan componentes confiables', async () => {
    LugarFalso.lugar = {
      id: 'ChIJ_uno',
      formattedAddress: 'Mar del Plata, Argentina',
      location: { lat: () => -38.0056, lng: () => -57.5426 },
      addressComponents: [{ types: ['route'], text: 'Av. Pedro Luro' }],
    };
    const token = await servicio.iniciarSesion();
    await servicio.buscar('Mar del Plata', token);

    const ubicacion = await servicio.obtenerDetalles(
      { id: 'ChIJ_uno', descripcion: 'Mar del Plata' },
      token,
    );

    expect(ubicacion).toEqual({
      direccion: 'Mar del Plata, Argentina',
      latitud: -38.0056,
      longitud: -57.5426,
      googlePlaceId: 'ChIJ_uno',
    });
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
