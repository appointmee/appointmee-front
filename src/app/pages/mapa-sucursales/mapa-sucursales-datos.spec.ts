import {
  SucursalMapaDTO,
  coordenadasValidas,
  filtrarSucursalesMapa,
  humanizarCategoria,
  urlCómoLlegar,
} from './mapa-sucursales-datos';

const CENTRO: SucursalMapaDTO = {
  id: 1,
  nombre: 'Sucursal Flores',
  categoria: 'SPA',
  fotoPerfil: null,
  puntuacion: 4.5,
  cantidadPuntuaciones: 10,
  latitud: -34.6037,
  longitud: -58.3816,
};

describe('US-MAP-06 · datos del mapa global', () => {
  describe('coordenadasValidas', () => {
    it('acepta solo pares numéricos finitos dentro del rango de Google Maps', () => {
      expect(coordenadasValidas(CENTRO)).toEqual({ lat: -34.6037, lng: -58.3816 });

      expect(
        coordenadasValidas({ ...CENTRO, latitud: null, longitud: null }),
      ).toBeNull();
      expect(coordenadasValidas({ ...CENTRO, latitud: Number.NaN })).toBeNull();
      expect(coordenadasValidas({ ...CENTRO, latitud: -91 })).toBeNull();
      expect(coordenadasValidas({ ...CENTRO, longitud: 181 })).toBeNull();
      expect(
        coordenadasValidas({ ...CENTRO, latitud: '-34.6' as unknown as number }),
      ).toBeNull();
    });
  });

  describe('filtrarSucursalesMapa', () => {
    const norte: SucursalMapaDTO = {
      ...CENTRO,
      id: 2,
      nombre: 'Sucursal Norte',
      categoria: 'BARBERIA',
    };

    it('busca por nombre sin distinguir mayúsculas ni acentos', () => {
      const resultado = filtrarSucursalesMapa(
        [CENTRO, norte],
        '  FLORES  ',
        null,
      );

      expect(resultado.map((sucursal) => sucursal.id)).toEqual([1]);
    });

    it('trata los términos numéricos como ID exacto, igual que el listado', () => {
      expect(
        filtrarSucursalesMapa([CENTRO, norte], '2', null).map((s) => s.id),
      ).toEqual([2]);
      expect(
        filtrarSucursalesMapa([CENTRO, norte], '20', null),
      ).toEqual([]);
    });

    it('combina nombre y categoría y deja pasar todo con filtros vacíos', () => {
      expect(
        filtrarSucursalesMapa([CENTRO, norte], 'Sucursal', 'SPA').map((s) => s.id),
      ).toEqual([1]);
      expect(filtrarSucursalesMapa([CENTRO, norte], '', null)).toHaveLength(2);
    });
  });

  it('construye Cómo llegar solo con latitud y longitud persistidas', () => {
    const url = new URL(urlCómoLlegar({ lat: -34.6037, lng: -58.3816 }));

    expect(url.origin + url.pathname).toBe('https://www.google.com/maps/dir/');
    expect(url.searchParams.get('destination')).toBe('-34.6037,-58.3816');
    expect(url.searchParams.get('api')).toBe('1');
    expect(url.searchParams.has('key')).toBe(false);
    expect(url.searchParams.has('origin')).toBe(false);
  });

  it('humaniza categorías con el mismo formato del listado tradicional', () => {
    expect(humanizarCategoria('CENTRO_DE_BELLEZA')).toBe('Centro De Belleza');
    expect(humanizarCategoria(null)).toBe('');
  });
});
