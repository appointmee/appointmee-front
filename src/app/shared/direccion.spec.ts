import { formatearDireccionResumida } from './direccion';

describe('US-MAP-05 · Resumen de dirección en el detalle', () => {
  it('muestra calle y altura con la localidad, sin código postal, provincia ni país', () => {
    expect(
      formatearDireccionResumida(
        '25 de Mayo 2899, B7600GWG Mar del Plata, Provincia de Buenos Aires, Argentina',
      ),
    ).toBe('25 de Mayo 2899, Mar del Plata');
  });

  it('acepta códigos postales de cuatro dígitos y sin letra provincial', () => {
    expect(
      formatearDireccionResumida('Calle 12 345, 7600 Mar del Plata, Buenos Aires, Argentina'),
    ).toBe('Calle 12 345, Mar del Plata');
  });

  it('conserva la localidad cuando la dirección no trae código postal', () => {
    expect(formatearDireccionResumida('Av. Corrientes 1234, CABA, Argentina')).toBe(
      'Av. Corrientes 1234, CABA',
    );
  });

  it('omite provincia y país si no hay localidad intermedia', () => {
    expect(
      formatearDireccionResumida('Ruta 7 1234, Provincia de Buenos Aires, Argentina'),
    ).toBe('Ruta 7 1234');
  });

  it('no inventa localidad en direcciones antiguas con referencias de unidad', () => {
    expect(formatearDireccionResumida('Av. Corrientes 1234, piso 2')).toBe(
      'Av. Corrientes 1234',
    );
  });

  it('busca la localidad después de una referencia de unidad', () => {
    expect(
      formatearDireccionResumida('Av. Corrientes 1234, piso 2, CABA, Argentina'),
    ).toBe('Av. Corrientes 1234, CABA');
  });

  it('deja intacta una dirección que solo tiene calle y altura', () => {
    expect(formatearDireccionResumida('Av. Siempre Viva 742')).toBe('Av. Siempre Viva 742');
  });

  it('normaliza espacios y comas vacías', () => {
    expect(
      formatearDireccionResumida('  25 de Mayo  2899 ,  , B7600GWG  Mar del Plata , Argentina '),
    ).toBe('25 de Mayo 2899, Mar del Plata');
  });

  it('devuelve cadena vacía cuando no hay dirección', () => {
    expect(formatearDireccionResumida(null)).toBe('');
    expect(formatearDireccionResumida(undefined)).toBe('');
    expect(formatearDireccionResumida('   ')).toBe('');
  });
});
