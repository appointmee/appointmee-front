import {
  ABEJA_MAPA,
  SucursalMapaDTO,
  abejasMapa,
  coincideNombre,
  coordenadasValidas,
  diasMapa,
  filtrarSucursalesMapa,
  humanizarCategoria,
  iconoIndicadorMapa,
  puntuacionMapa,
  terminoDeBusquedaMapa,
  textoIndicadorMapa,
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

  describe('búsqueda por nombre (sin ID)', () => {
    const norte: SucursalMapaDTO = {
      ...CENTRO,
      id: 2,
      nombre: 'Sucursal Norte',
      categoria: 'BARBERIA',
    };

    it('busca por nombre sin distinguir mayúsculas ni acentos', () => {
      expect(coincideNombre(CENTRO, '  FLORES  ')).toBe(true);
      expect(coincideNombre(norte, 'flores')).toBe(false);
      expect(
        filtrarSucursalesMapa([CENTRO, norte], '  FLORES  ', null).map(
          (sucursal) => sucursal.id,
        ),
      ).toEqual([1]);
    });

    it('no busca por ID exacto ni por coincidencia parcial del ID', () => {
      expect(coincideNombre(norte, '2')).toBe(false);
      expect(coincideNombre(norte, '20')).toBe(false);
      expect(filtrarSucursalesMapa([CENTRO, norte], '2', null)).toEqual([]);
      expect(filtrarSucursalesMapa([CENTRO, norte], '20', null)).toEqual([]);
    });

    it('respeta el mínimo de caracteres también para términos numéricos', () => {
      expect(terminoDeBusquedaMapa('1')).toBe('');
      expect(terminoDeBusquedaMapa('12')).toBe('12');
      expect(terminoDeBusquedaMapa(' FLORES ')).toBe('FLORES');
    });

    it('admite búsquedas numéricas si aparecen en el nombre, nunca por ID', () => {
      const sucursal: SucursalMapaDTO = { ...CENTRO, id: 99, nombre: 'Sucursal 12' };

      expect(coincideNombre(sucursal, '12')).toBe(true);
      expect(coincideNombre(sucursal, '99')).toBe(false);
    });

    it('combina nombre y categoría y deja pasar todo con filtros vacíos', () => {
      expect(
        filtrarSucursalesMapa([CENTRO, norte], 'Sucursal', 'SPA').map((s) => s.id),
      ).toEqual([1]);
      expect(
        filtrarSucursalesMapa([CENTRO, norte], 'Norte', 'SPA'),
      ).toEqual([]);
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

  describe('indicadores de valoración', () => {
    it('muestra la puntuación real o un guion, nunca un valor inventado', () => {
      expect(puntuacionMapa(CENTRO)).toBe(4.5);
      expect(textoIndicadorMapa(CENTRO)).toBe('4.5');
      expect(textoIndicadorMapa({ ...CENTRO, puntuacion: 5 })).toBe('5');
      expect(textoIndicadorMapa({ ...CENTRO, puntuacion: null })).toBe('-');
      expect(textoIndicadorMapa({ ...CENTRO, puntuacion: 0 })).toBe('-');
      expect(textoIndicadorMapa({ ...CENTRO, puntuacion: 0.5 })).toBe('-');
      expect(textoIndicadorMapa({ ...CENTRO, puntuacion: 6 })).toBe('-');
    });

    it('adapta el ancho para que el decimal y la abeja no se corten', () => {
      const svg = decodeURIComponent(
        iconoIndicadorMapa('3.8', '#f7c65a'),
      );

      expect(svg).toContain('width="62"');
      expect(svg).toContain('viewBox="0 0 62 56"');
      expect(svg).toContain('x="31"');
      expect(svg).toContain('text-anchor="middle"');
      expect(svg).toContain('dominant-baseline="middle"');
      expect(svg).toContain('>3.8</tspan>');
      expect(svg).toContain(ABEJA_MAPA);
      expect(svg).toContain('fill="#f7c65a"');
      expect(svg).toContain('fill="#07090d"');
      expect(svg).not.toContain('Flores');
      expect(svg).not.toContain('SPA');
    });

    it('mantiene compacto el indicador con puntuación entera', () => {
      const svg = decodeURIComponent(iconoIndicadorMapa('5', '#f7c65a'));

      expect(svg).toContain('width="44"');
      expect(svg).toContain('viewBox="0 0 44 56"');
      expect(svg).toContain('x="22"');
      expect(svg).toContain('>5</tspan>');
      expect(svg).toContain(ABEJA_MAPA);
    });

    it('muestra un guion y la abeja cuando no hay reseñas', () => {
      const svg = decodeURIComponent(
        iconoIndicadorMapa(textoIndicadorMapa({ ...CENTRO, puntuacion: null }), '#f7c65a'),
      );

      expect(svg).toContain('width="44"');
      expect(svg).toContain('>-<');
      expect(svg).toContain(ABEJA_MAPA);
      expect(svg).not.toMatch(/>[\d.]+</);
    });

    it('usa el token de acento y descarta colores inválidos', () => {
      expect(decodeURIComponent(iconoIndicadorMapa('3', '#abc'))).toContain(
        'fill="#abc"',
      );
      expect(
        decodeURIComponent(iconoIndicadorMapa('3', '#abc', '#111')),
      ).toContain('fill="#111"');
      expect(decodeURIComponent(iconoIndicadorMapa('3', 'url(x)'))).toContain(
        'fill="#f7c65a"',
      );
    });

    it('llena las abejas hasta el valor redondeado', () => {
      expect(abejasMapa(4.5)).toEqual([true, true, true, true, true]);
      expect(abejasMapa(3.2)).toEqual([true, true, true, false, false]);
      expect(abejasMapa(null)).toEqual([false, false, false, false, false]);
    });
  });

  describe('días de apertura', () => {
    it('representa los siete días con abreviaturas y estado real del DTO', () => {
      const dias = diasMapa({
        ...CENTRO,
        diasApertura: ['MONDAY', 'MIÉRCOLES', 'SUNDAY'],
      });

      expect(dias.map((dia) => dia.abreviatura)).toEqual([
        'LU', 'MA', 'MI', 'JU', 'VI', 'SA', 'DO',
      ]);
      expect(dias.filter((dia) => dia.abierto).map((dia) => dia.abreviatura)).toEqual([
        'LU', 'MI', 'DO',
      ]);
      expect(dias.filter((dia) => !dia.abierto).map((dia) => dia.abreviatura)).toEqual([
        'MA', 'JU', 'VI', 'SA',
      ]);
    });

    it('no asume que abre todos los días cuando el DTO no trae días', () => {
      expect(diasMapa({ ...CENTRO, diasApertura: undefined }).every((dia) => !dia.abierto)).toBe(true);
    });
  });
});
