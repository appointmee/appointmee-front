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
  setMap(mapa: MapaGoogle | null): void;
  setTitle(titulo: string): void;
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

interface EntradaMarcador {
  readonly marcador: MarcadorGoogle;
  readonly sucursal: SucursalMapaDTO;
  readonly listener: ListenerGoogle;
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
  private seleccion: number | null = null;

  constructor(
    private readonly api: GoogleMapsApi,
    private readonly mapa: MapaGoogle,
  ) {
    this.ventana = new api.maps.InfoWindow();
  }

  get cantidadMarcadores(): number {
    return this.marcadores.size;
  }

  actualizar(
    sucursales: readonly SucursalMapaDTO[],
    contenido: ContenidoVentana,
  ): void {
    const visibles = sucursales
      .map((sucursal) => ({ sucursal, coordenadas: coordenadasValidas(sucursal) }))
      .filter((entrada) => entrada.coordenadas !== null) as {
      readonly sucursal: SucursalMapaDTO;
      readonly coordenadas: CoordenadasMapa;
    }[];
    const idsDeseados = new Set(visibles.map(({ sucursal }) => sucursal.id));

    for (const [id, entrada] of this.marcadores) {
      if (idsDeseados.has(id)) {
        continue;
      }
      this.removerMarcador(id, entrada);
    }

    for (const { sucursal, coordenadas } of visibles) {
      const posicion = new this.api.maps.LatLng(coordenadas.lat, coordenadas.lng);
      const entrada = this.marcadores.get(sucursal.id);

      if (entrada) {
        entrada.marcador.setPosition(posicion);
        entrada.marcador.setTitle(sucursal.nombre);
        continue;
      }

      const marcador = new this.api.maps.Marker({
        position: posicion,
        map: this.mapa,
        title: sucursal.nombre,
      });
      const listener = marcador.addListener('click', () => {
        this.abrir(sucursal.id, contenido(sucursal), marcador);
      });
      this.marcadores.set(sucursal.id, {
        marcador,
        sucursal,
        listener,
      });
    }

    if (this.seleccion !== null && !idsDeseados.has(this.seleccion)) {
      this.cerrarVentana();
    }

    if (visibles.length === 1) {
      this.mapa.setCenter(
        new this.api.maps.LatLng(
          visibles[0].coordenadas.lat,
          visibles[0].coordenadas.lng,
        ),
      );
      return;
    }

    if (visibles.length > 1) {
      const limites = new this.api.maps.LatLngBounds();
      for (const { coordenadas } of visibles) {
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
    this.seleccion = null;
    this.ventana.close();
  }

  destruir(): void {
    this.cerrarVentana();
    for (const [id, entrada] of this.marcadores) {
      this.removerMarcador(id, entrada);
    }
  }

  private abrir(
    id: number,
    contenido: Node | string,
    marcador: MarcadorGoogle,
  ): void {
    this.seleccion = id;
    this.ventana.setContent(contenido);
    this.ventana.open(this.mapa, marcador);
  }

  private removerMarcador(id: number, entrada: EntradaMarcador): void {
    entrada.listener.remove();
    this.api.maps.event.clearInstanceListeners(entrada.marcador);
    entrada.marcador.setMap(null);
    this.marcadores.delete(id);
  }
}
