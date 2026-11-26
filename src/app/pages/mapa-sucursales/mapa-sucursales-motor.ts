import {
  CoordenadasMapa,
  SucursalMapaDTO,
  coordenadasValidas,
} from './mapa-sucursales-datos';

/** Superficie mínima de la Maps JavaScript API que usa esta pantalla. */
export type PuntoGoogle = unknown;
export interface MapaGoogle {
  setCenter(centro: PuntoGoogle): void;
  fitBounds(bounds: LimitesGoogle, padding?: number): void;
  addListener(evento: string, manejador: () => void): ListenerGoogle;
}
export interface LimitesGoogle {
  extend(punto: PuntoGoogle): LimitesGoogle;
  isEmpty(): boolean;
}
export interface ListenerGoogle {
  remove(): void;
}
export interface MarcadorGoogle {
  setPosition(posicion: PuntoGoogle): void;
  setIcon(url: string): void;
  setMap(mapa: MapaGoogle | null): void;
  addListener(evento: string, manejador: () => void): ListenerGoogle;
}
export interface VentanaGoogle {
  setContent(contenido: Node | string): void;
  open(mapa?: MapaGoogle | null, marcador?: MarcadorGoogle | null): void;
  close(): void;
}
export interface GoogleMapsApi {
  maps: {
    Map: new (elemento: HTMLElement, opciones: Record<string, unknown>) => MapaGoogle;
    Marker: new (opciones: Record<string, unknown>) => MarcadorGoogle;
    InfoWindow: new (opciones?: Record<string, unknown>) => VentanaGoogle;
    LatLng: new (lat: number, lng: number) => PuntoGoogle;
    LatLngBounds: new () => LimitesGoogle;
    event: {
      clearInstanceListeners(instancia: unknown): void;
    };
  };
}

type ContenidoVentana = (sucursal: SucursalMapaDTO) => Node | string;
type IconoMarcador = (sucursal: SucursalMapaDTO) => string;

interface EntradaMarcador {
  readonly marcador: MarcadorGoogle;
  readonly sucursal: SucursalMapaDTO;
  readonly listener: ListenerGoogle;
  icono: string;
}

/** Separación mínima para sucursales que comparten exactamente la misma posición. */
const PASO_SUPERPOSICION = 0.00012;

/**
 * Reparte en torno al punto real los indicadores que, de otro modo, quedarían
 * apilados. El desplazamiento es determinista y se recalcula al filtrar.
 */
function posicionVisible(
  coordenadas: CoordenadasMapa,
  indice: number,
): CoordenadasMapa {
  if (indice === 0) {
    return coordenadas;
  }
  const angulo = ((indice - 1) % 8) * (Math.PI / 4);
  const anillo = Math.floor((indice - 1) / 8) + 1;
  const radio = PASO_SUPERPOSICION * anillo;
  return {
    lat: coordenadas.lat + Math.sin(angulo) * radio,
    lng: coordenadas.lng + Math.cos(angulo) * radio,
  };
}

/**
 * Mantiene un único conjunto de marcadores y una única InfoWindow.
 *
 * Los cambios de filtros solo agregan, quitan o reposicionan los marcadores
 * necesarios: nunca reconstruyen el mapa ni vuelven a cargar Google Maps.
 */
export class MotorMapaSucursales {
  private readonly marcadores = new Map<number, EntradaMarcador>();
  private readonly ventana: VentanaGoogle;
  private readonly listenerMapa: ListenerGoogle;
  private ubicacionCliente: MarcadorGoogle | null = null;
  private seleccion: number | null = null;
  private abierta = false;

  constructor(
    private readonly api: GoogleMapsApi,
    private readonly mapa: MapaGoogle,
    private readonly alCerrar: () => void = () => undefined,
    private readonly alAbrir: (contenido: Node | string) => void = () => undefined,
  ) {
    this.ventana = new api.maps.InfoWindow();
    this.listenerMapa = mapa.addListener('click', () => this.cerrarVentana());
  }

  get cantidadMarcadores(): number {
    return this.marcadores.size;
  }

  get ubicacionClienteVisible(): boolean {
    return this.ubicacionCliente !== null;
  }

  /**
   * US-MAP-07 · Dibuja un único indicador propio para el cliente y centra el
   * mapa en él. No toca los marcadores de sucursales ni sus filtros.
   */
  mostrarUbicacionCliente(
    coordenadas: CoordenadasMapa,
    icono: string,
    titulo = 'Tu ubicación',
  ): void {
    if (this.ubicacionCliente) {
      this.ubicacionCliente.setMap(null);
    }
    const posicion = new this.api.maps.LatLng(coordenadas.lat, coordenadas.lng);
    this.ubicacionCliente = new this.api.maps.Marker({
      position: posicion,
      map: this.mapa,
      icon: icono,
      title: titulo,
      zIndex: 1000,
    });
    this.mapa.setCenter(posicion);
  }

  get seleccionActual(): number | null {
    return this.seleccion;
  }

  get ventanaAbierta(): boolean {
    return this.abierta;
  }

  actualizar(
    sucursales: readonly SucursalMapaDTO[],
    contenido: ContenidoVentana,
    icono: IconoMarcador,
  ): void {
    // Toda actualización de marcadores (filtros o recarga) deselecciona.
    this.cerrarVentana();

    const visibles = sucursales
      .map((sucursal) => ({ sucursal, coordenadas: coordenadasValidas(sucursal) }))
      .filter((entrada) => entrada.coordenadas !== null) as {
      readonly sucursal: SucursalMapaDTO;
      readonly coordenadas: CoordenadasMapa;
    }[];
    const idsDeseados = new Set(visibles.map(({ sucursal }) => sucursal.id));

    const repetidos = new Map<string, number>();
    const posiciones = visibles.map(({ sucursal, coordenadas }) => {
      const clave = `${coordenadas.lat},${coordenadas.lng}`;
      const indice = repetidos.get(clave) ?? 0;
      repetidos.set(clave, indice + 1);
      return {
        sucursal,
        coordenadas: posicionVisible(coordenadas, indice),
      };
    });

    for (const [id, entrada] of this.marcadores) {
      if (idsDeseados.has(id)) {
        continue;
      }
      this.removerMarcador(id, entrada);
    }

    for (const { sucursal, coordenadas } of posiciones) {
      const posicion = new this.api.maps.LatLng(coordenadas.lat, coordenadas.lng);
      const iconoNuevo = icono(sucursal);
      const entrada = this.marcadores.get(sucursal.id);

      if (entrada) {
        entrada.marcador.setPosition(posicion);
        if (entrada.icono !== iconoNuevo) {
          entrada.marcador.setIcon(iconoNuevo);
          entrada.icono = iconoNuevo;
        }
        continue;
      }

      const marcador = new this.api.maps.Marker({
        position: posicion,
        map: this.mapa,
        icon: iconoNuevo,
      });
      const listener = marcador.addListener('click', () => {
        this.cerrarVentana();
        this.abrir(sucursal.id, contenido(sucursal), marcador);
      });
      this.marcadores.set(sucursal.id, {
        marcador,
        sucursal,
        listener,
        icono: iconoNuevo,
      });
    }

    if (posiciones.length === 1) {
      this.mapa.setCenter(
        new this.api.maps.LatLng(
          posiciones[0].coordenadas.lat,
          posiciones[0].coordenadas.lng,
        ),
      );
      return;
    }

    if (posiciones.length > 1) {
      const limites = new this.api.maps.LatLngBounds();
      for (const { coordenadas } of posiciones) {
        limites.extend(
          new this.api.maps.LatLng(coordenadas.lat, coordenadas.lng),
        );
      }
      if (!limites.isEmpty()) {
        this.mapa.fitBounds(limites, 48);
      }
    }
  }

  cerrarVentana(): void {
    if (this.abierta) {
      this.abierta = false;
      this.alCerrar();
    }
    this.seleccion = null;
    this.ventana.close();
  }

  destruir(): void {
    this.cerrarVentana();
    this.listenerMapa.remove();
    if (this.ubicacionCliente) {
      this.ubicacionCliente.setMap(null);
      this.ubicacionCliente = null;
    }
    for (const [id, entrada] of this.marcadores) {
      this.removerMarcador(id, entrada);
    }
  }

  private abrir(
    id: number,
    contenido: Node | string,
    marcador: MarcadorGoogle,
  ): void {
    if (this.abierta) {
      this.cerrarVentana();
    }
    this.seleccion = id;
    this.abierta = true;
    this.ventana.setContent(contenido);
    this.ventana.open(this.mapa, marcador);
    // El wrapper de Google ya está en el DOM: la vista puede quitarle el marco.
    this.alAbrir(contenido);
  }

  private removerMarcador(id: number, entrada: EntradaMarcador): void {
    entrada.listener.remove();
    this.api.maps.event.clearInstanceListeners(entrada.marcador);
    entrada.marcador.setMap(null);
    this.marcadores.delete(id);
  }
}
