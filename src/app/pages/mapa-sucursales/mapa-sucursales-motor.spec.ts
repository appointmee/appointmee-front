import { SucursalMapaDTO } from './mapa-sucursales-datos';
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
  readonly titulos: string[] = [];
  mapa: MapaGoogle | null = null;
  listener: (() => void) | null = null;
  removido = false;

  constructor(readonly opciones: Record<string, unknown>) {}

  setPosition(posicion: PuntoGoogle): void {
    this.posiciones.push(posicion);
  }

  setMap(mapa: MapaGoogle | null): void {
    this.mapa = mapa;
    if (mapa === null) this.removido = true;
  }

  setTitle(titulo: string): void {
    this.titulos.push(titulo);
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

function sucursal(id: number, latitud: number | null): SucursalMapaDTO {
  return {
    id,
    nombre: `Sucursal ${id}`,
    categoria: 'SPA',
    fotoPerfil: null,
    puntuacion: null,
    cantidadPuntuaciones: 0,
    latitud,
    longitud: latitud === null ? null : latitud / 2,
  };
}

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

describe('US-MAP-06 · motor de marcadores', () => {
  const contenido = (sucursal: SucursalMapaDTO) => `${sucursal.nombre}`;

  it('crea un marcador por sucursal con coordenadas válidas y ajusta el encuadre', () => {
    const { api, mapa, marcadores, limites } = crearApi();
    const motor = new MotorMapaSucursales(api, mapa);

    motor.actualizar(
      [sucursal(1, -34.6), sucursal(2, -35.2), sucursal(3, null)],
      contenido,
    );

    expect(marcadores).toHaveLength(2);
    expect(motor.cantidadMarcadores).toBe(2);
    expect(marcadores[0].opciones['map']).toBe(mapa);
    expect(mapa.limites).toHaveLength(1);
    expect(limites[0].puntos).toHaveLength(2);
    expect(mapa.centros).toHaveLength(0);
  });

  it('reutiliza marcadores y quita los obsoletos al cambiar los filtros', () => {
    const { api, mapa, marcadores } = crearApi();
    const motor = new MotorMapaSucursales(api, mapa);
    const centro = sucursal(1, -34.6);
    const norte = sucursal(2, -35.2);

    motor.actualizar([centro, norte], contenido);
    motor.actualizar([centro], contenido);

    expect(marcadores).toHaveLength(2);
    expect(marcadores[1].removido).toBe(true);
    expect(marcadores[1].listener).toBeNull();
    expect(motor.cantidadMarcadores).toBe(1);
    expect(mapa.centros).toHaveLength(1);

    motor.actualizar([centro, norte], contenido);

    expect(marcadores).toHaveLength(3);
    expect(motor.cantidadMarcadores).toBe(2);
  });

  it('centra el mapa en el único resultado y cierra la ventana si desaparece', () => {
    const { api, mapa, ventana, marcadores } = crearApi();
    const motor = new MotorMapaSucursales(api, mapa);
    const centro = sucursal(1, -34.6);
    const norte = sucursal(2, -35.2);

    motor.actualizar([centro, norte], contenido);
    marcadores[0].listener?.();
    expect(ventana.abierta).toBe(true);
    expect(ventana.contenido).toBe('Sucursal 1');

    motor.actualizar([norte], contenido);

    expect(ventana.abierta).toBe(false);
    expect(mapa.centros).toHaveLength(1);
  });

  it('libera todos los marcadores al destruir el motor', () => {
    const { api, mapa, marcadores } = crearApi();
    const motor = new MotorMapaSucursales(api, mapa);

    motor.actualizar([sucursal(1, -34.6), sucursal(2, -35.2)], contenido);
    motor.destruir();

    expect(marcadores.every((marcador) => marcador.removido)).toBe(true);
    expect(motor.cantidadMarcadores).toBe(0);
  });
});
