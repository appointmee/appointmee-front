import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SucursalDetalleDTO } from '../../models/sucursal';
import { GOOGLE_MAPS_CONFIG } from '../../services/google-maps-service';
import { MapaSucursal } from './mapa-sucursal';

const SUCURSAL: SucursalDetalleDTO = {
  id: 7,
  nombre: 'Sucursal Flores',
  direccion: 'Av. Rivadavia 123',
  telefono: null,
  descripcion: null,
  fechaCreacion: null,
  categoria: null,
  horaApertura: null,
  horaCierre: null,
  diasApertura: null,
  puntuacion: null,
  cantidadPuntuaciones: null,
  fotoPerfil: null,
};

class ObservadorFalso {
  private alIngresar: (() => void) | null = null;

  constructor(private readonly callback: IntersectionObserverCallback) {}

  observe(): void {
    // El disparo lo controla cada test con `revelar()`.
  }

  disconnect(): void {
    this.alIngresar = null;
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  registrarDisparo(): void {
    this.alIngresar = () =>
      this.callback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        null as unknown as IntersectionObserver,
      );
  }

  revelar(): void {
    this.alIngresar?.();
  }
}

describe('US-MAP-05 · Mapa embebido en el detalle público', () => {
  let fixture: ComponentFixture<MapaSucursal>;
  let observador: ObservadorFalso | null = null;

  async function configurar(clave: string): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [MapaSucursal],
      providers: [{ provide: GOOGLE_MAPS_CONFIG, useValue: { apiKey: clave } }],
    }).compileComponents();
  }

  function crear(datos: Partial<SucursalDetalleDTO>): HTMLElement {
    observador = null;
    fixture = TestBed.createComponent(MapaSucursal);
    fixture.componentRef.setInput('sucursal', { ...SUCURSAL, ...datos });
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function revelar(): void {
    observador?.revelar();
    fixture.detectChanges();
  }

  beforeEach(() => {
    vi.stubGlobal(
      'IntersectionObserver',
      class extends ObservadorFalso {
        constructor(callback: IntersectionObserverCallback) {
          super(callback);
          this.registrarDisparo();
          observador = this;
        }
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('no crea el iframe hasta que la sección entra en el viewport', async () => {
    await configurar('clave-de-prueba');
    const host = crear({ googlePlaceId: 'ChIJ_prueba' });

    expect(host.querySelector('iframe')).toBeNull();
    expect(host.querySelector('.mapa__placeholder')).not.toBeNull();

    revelar();
    const iframe = host.querySelector<HTMLIFrameElement>('iframe');

    expect(iframe).not.toBeNull();
    expect(iframe?.getAttribute('loading')).toBe('lazy');
    expect(iframe?.getAttribute('title')).toBe('Mapa de ubicación de Sucursal Flores');
  });

  it('prioriza el Google Place ID y no consulta otros servicios', async () => {
    await configurar('clave-de-prueba');
    const host = crear({
      googlePlaceId: 'ChIJ_prueba',
      latitud: -34.6037,
      longitud: -58.3816,
    });
    revelar();

    const url = new URL(host.querySelector<HTMLIFrameElement>('iframe')?.getAttribute('src') ?? '');
    expect(url.origin + url.pathname).toBe('https://www.google.com/maps/embed/v1/place');
    expect(url.searchParams.get('key')).toBe('clave-de-prueba');
    expect(url.searchParams.get('q')).toBe('place_id:ChIJ_prueba');
    expect(url.searchParams.get('center')).toBeNull();
  });

  it('usa latitud y longitud cuando no hay Google Place ID', async () => {
    await configurar('clave-de-prueba');
    const host = crear({ googlePlaceId: null, latitud: -34.6037, longitud: -58.3816 });
    revelar();

    const url = new URL(host.querySelector<HTMLIFrameElement>('iframe')?.getAttribute('src') ?? '');
    expect(url.origin + url.pathname).toBe('https://www.google.com/maps/embed/v1/view');
    expect(url.searchParams.get('center')).toBe('-34.6037,-58.3816');
    expect(url.searchParams.get('zoom')).toBe('16');
    expect(url.searchParams.get('q')).toBeNull();
  });

  it('muestra un mensaje claro para sucursales antiguas sin ubicación', async () => {
    await configurar('clave-de-prueba');
    const host = crear({ googlePlaceId: null, latitud: null, longitud: null });

    expect(host.textContent).toContain('todavía no tiene una ubicación registrada');
    expect(host.querySelector('iframe')).toBeNull();
  });

  it('no muestra el mapa cuando las coordenadas están fuera de rango', async () => {
    await configurar('clave-de-prueba');
    const host = crear({ latitud: -91, longitud: 200 });

    expect(host.textContent).toContain('todavía no tiene una ubicación registrada');
    expect(host.querySelector('iframe')).toBeNull();
  });

  it('muestra un estado alternativo y no carga Google si falta la API key', async () => {
    await configurar('');
    const host = crear({ googlePlaceId: 'ChIJ_prueba' });
    revelar();

    expect(host.textContent).toContain('No pudimos mostrar el mapa en este momento');
    expect(host.textContent).toContain('Av. Rivadavia 123');
    expect(host.querySelector('iframe')).toBeNull();
  });

  it('mantiene el detalle usable si el iframe falla', async () => {
    await configurar('clave-de-prueba');
    const host = crear({ googlePlaceId: 'ChIJ_prueba' });
    revelar();

    const iframe = host.querySelector<HTMLIFrameElement>('iframe');
    expect(iframe).not.toBeNull();
    iframe?.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    expect(host.querySelector('iframe')).toBeNull();
    expect(host.textContent).toContain('No pudimos mostrar el mapa en este momento');
    expect(host.querySelector('[role="status"]')).not.toBeNull();
  });
});
