import {
  SucursalMapaDTO,
  iconoIndicadorMapa,
  textoIndicadorMapa,
} from './mapa-sucursales-datos';
import {
  GoogleMapsApi,
  LimitesGoogle,
  ListenerGoogle,
  MapaGoogle,
  MarcadorGoogle,
  MotorMapaSucursales,
  PuntoGoogle,
  VentanaGoogle,
} from './mapa-sucursales-motor';

class MarcadorFalso implements MarcadorGoogle {
  readonly posiciones: PuntoGoogle[] = [];
  readonly iconos: string[] = [];
  mapa: MapaGoogle | null = null;
  listener: (() => void) | null = null;
  removido = false;

  constructor(readonly opciones: Record<string, unknown>) {
    this.iconos.push(String(opciones['icon'] ?? ''));
  }

  setPosition(posicion: PuntoGoogle): void {
    this.posiciones.push(posicion);
  }

  setIcon(url: string): void {
    this.iconos.push(url);
  }

  setMap(mapa: MapaGoogle | null): void {
    this.mapa = mapa;
    if (mapa === null) this.removido = true;
  }

  addListener(_evento: string, manejador: () => void): ListenerGoogle {
    this.listener = manejador;
    return {
      remove: () => {
        this.listener = null;
      },
    };
  }
}

class VentanaFalsa implements VentanaGoogle {
  contenido: Node | string | null = null;
  abierta = false;

  setContent(contenido: Node | string): void {
    this.contenido = contenido;
  }

  open(): void {
    this.abierta = true;
  }

  close(): void {
    this.abierta = false;
  }
}

class MapaFalso implements MapaGoogle {
  centros: PuntoGoogle[] = [];
  limites: LimitesGoogle[] = [];

  setCenter(centro: PuntoGoogle): void {
    this.centros.push(centro);
  }

  fitBounds(bounds: LimitesGoogle): void {
    this.limites.push(bounds);
  }
}

class LimitesFalsos implements LimitesGoogle {
  readonly puntos: PuntoGoogle[] = [];

  extend(punto: PuntoGoogle): LimitesGoogle {
    this.puntos.push(punto);
    return this;
  }

  isEmpty(): boolean {
    return this.puntos.length === 0;
  }
}

function sucursal(
  id: number,
  latitud: number | null,
  puntuacion: number | null = null,
): SucursalMapaDTO {
  return {
    id,
    nombre: `Sucursal ${id}`,
    categoria: 'SPA',
    fotoPerfil: null,
    puntuacion,
    cantidadPuntuaciones: puntuacion === null ? 0 : 3,
    latitud,
    longitud: latitud === null ? null : latitud / 2,
  };
}

const icono = (sucursalActual: SucursalMapaDTO): string =>
  iconoIndicadorMapa(textoIndicadorMapa(sucursalActual), '#f7c65a');

function crearApi(): {
  api: GoogleMapsApi;
  mapa: MapaFalso;
  ventana: VentanaFalsa;
  marcadores: MarcadorFalso[];
  limites: LimitesFalsos[];
} {
  const mapa = new MapaFalso();
  const ventana = new VentanaFalsa();
  const marcadores: MarcadorFalso[] = [];
  const limites: LimitesFalsos[] = [];

  const api = {
    maps: {
      Map: function () {
        return mapa;
      },
      Marker: function (opciones: Record<string, unknown>) {
        const marcador = new MarcadorFalso(opciones);
        marcadores.push(marcador);
        return marcador;
      },
      InfoWindow: function () {
        return ventana;
      },
      LatLng: function (lat: number, lng: number) {
        return { lat, lng };
      },
      LatLngBounds: function () {
        const instancia = new LimitesFalsos();
        limites.push(instancia);
        return instancia;
      },
      event: { clearInstanceListeners: vi.fn() },
    },
  } as unknown as GoogleMapsApi;

  return { api, mapa, ventana, marcadores, limites };
}

describe('US-MAP-06 · motor de indicadores', () => {
  const contenido = (sucursalActual: SucursalMapaDTO) => `${sucursalActual.nombre}`;

  it('crea un indicador amarillo por sucursal válida y ajusta el encuadre', () => {
    const { api, mapa, marcadores, limites } = crearApi();
    const motor = new MotorMapaSucursales(api, mapa);

    motor.actualizar(
      [
        sucursal(1, -34.6, 4.5),
        sucursal(2, -35.2, null),
        sucursal(3, null),
      ],
      contenido,
      icono,
    );

    expect(marcadores).toHaveLength(2);
    expect(motor.cantidadMarcadores).toBe(2);
    expect(marcadores[0].opciones['map']).toBe(mapa);
    expect(decodeURIComponent(marcadores[0].iconos[0])).toContain('>4.5<');
    expect(decodeURIComponent(marcadores[1].iconos[0])).not.toMatch(/>[\d.]+</);
    expect(decodeURIComponent(marcadores[0].iconos[0])).not.toContain('Sucursal 1');
    expect(mapa.limites).toHaveLength(1);
    expect(limites[0].puntos).toHaveLength(2);
    expect(mapa.centros).toHaveLength(0);
  });

  it('reutiliza marcadores y quita los obsoletos al cambiar los filtros', () => {
    const { api, mapa, marcadores } = crearApi();
    const motor = new MotorMapaSucursales(api, mapa);
    const centro = sucursal(1, -34.6);
    const norte = sucursal(2, -35.2);

    motor.actualizar([centro, norte], contenido, icono);
    motor.actualizar([centro], contenido, icono);

    expect(marcadores).toHaveLength(2);
    expect(marcadores[1].removido).toBe(true);
    expect(marcadores[1].listener).toBeNull();
    expect(motor.cantidadMarcadores).toBe(1);
    expect(mapa.centros).toHaveLength(1);

    motor.actualizar([centro, norte], contenido, icono);

    expect(marcadores).toHaveLength(3);
    expect(motor.cantidadMarcadores).toBe(2);
  });

  it('no duplica marcadores ni listeners si los filtros no cambian', () => {
    const { api, mapa, marcadores } = crearApi();
    const motor = new MotorMapaSucursales(api, mapa);
    const centro = sucursal(1, -34.6, 4);

    motor.actualizar([centro], contenido, icono);
    motor.actualizar([centro], contenido, icono);

    expect(marcadores).toHaveLength(1);
    expect(marcadores[0].iconos).toHaveLength(1);
    expect(marcadores[0].listener).not.toBeNull();
  });

  it('actualiza el indicador cuando cambia la valoración sin recrear el marcador', () => {
    const { api, mapa, marcadores } = crearApi();
    const motor = new MotorMapaSucursales(api, mapa);

    motor.actualizar([sucursal(1, -34.6, 2)], contenido, icono);
    motor.actualizar([sucursal(1, -34.6, 5)], contenido, icono);

    expect(marcadores).toHaveLength(1);
    expect(marcadores[0].iconos).toHaveLength(2);
    expect(decodeURIComponent(marcadores[0].iconos[1])).toContain('>5<');
  });

  it('separa indicadores con la misma coordenada sin perder ninguno', () => {
    const { api, mapa, marcadores, limites } = crearApi();
    const motor = new MotorMapaSucursales(api, mapa);

    motor.actualizar(
      [sucursal(1, -34.6, 4), sucursal(2, -34.6, 3)],
      contenido,
      icono,
    );

    expect(marcadores).toHaveLength(2);
    expect(marcadores[0].opciones['position']).not.toEqual(
      marcadores[1].opciones['position'],
    );
    expect(limites[0].puntos).toHaveLength(2);
  });

  it('centra el mapa en el único resultado y cierra la ventana si desaparece', () => {
    const { api, mapa, ventana, marcadores } = crearApi();
    const motor = new MotorMapaSucursales(api, mapa);
    const centro = sucursal(1, -34.6);
    const norte = sucursal(2, -35.2);

    motor.actualizar([centro, norte], contenido, icono);
    marcadores[0].listener?.();
    expect(ventana.abierta).toBe(true);
    expect(ventana.contenido).toBe('Sucursal 1');

    motor.actualizar([norte], contenido, icono);

    expect(ventana.abierta).toBe(false);
    expect(mapa.centros).toHaveLength(1);
  });

  it('libera todos los marcadores al destruir el motor', () => {
    const { api, mapa, marcadores } = crearApi();
    const motor = new MotorMapaSucursales(api, mapa);

    motor.actualizar([sucursal(1, -34.6), sucursal(2, -35.2)], contenido, icono);
    motor.destruir();

    expect(marcadores.every((marcador) => marcador.removido)).toBe(true);
    expect(motor.cantidadMarcadores).toBe(0);
  });
});
