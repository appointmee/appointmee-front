import { formatearDuracion, formatearDuracionCompacta } from './duracion';

describe('Duración de los servicios', () => {
  describe('formatearDuracion', () => {
    it('expresa los minutos tal como los guarda el backend', () => {
      expect(formatearDuracion(30)).toBe('30 minutos');
      expect(formatearDuracion(45)).toBe('45 minutos');
    });

    it('expresa las horas y los minutos restantes', () => {
      expect(formatearDuracion(60)).toBe('1 hora');
      expect(formatearDuracion(90)).toBe('1 hora y 30 minutos');
      expect(formatearDuracion(120)).toBe('2 horas');
      expect(formatearDuracion(180)).toBe('3 horas');
      expect(formatearDuracion(360)).toBe('6 horas');
    });

    it('no inventa una duración cuando el dato no es utilizable', () => {
      expect(formatearDuracion(null)).toBe('Duración a confirmar');
      expect(formatearDuracion(undefined)).toBe('Duración a confirmar');
      expect(formatearDuracion(0)).toBe('Duración a confirmar');
      expect(formatearDuracion(Number.NaN)).toBe('Duración a confirmar');
    });
  });

  describe('formatearDuracionCompacta', () => {
    it('usa la forma abreviada de las tarjetas del listado', () => {
      expect(formatearDuracionCompacta(30)).toBe('30 min');
      expect(formatearDuracionCompacta(60)).toBe('1 h');
      expect(formatearDuracionCompacta(90)).toBe('1 h 30 min');
      expect(formatearDuracionCompacta(120)).toBe('2 h');
    });

    it('no inventa una duración cuando el dato no es utilizable', () => {
      expect(formatearDuracionCompacta(null)).toBe('Duración a confirmar');
      expect(formatearDuracionCompacta(0)).toBe('Duración a confirmar');
    });
  });
});
