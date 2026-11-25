import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, signal, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { googlePlacesService } from '../../services/google-places-service';
import { sucursalService } from '../../services/sucursal-service';
import { SucursalForm } from './sucursal-form';
import { SucursalFormDatos, SucursalFormModel } from './sucursal-form.model';

@Component({
  standalone: true,
  imports: [SucursalForm],
  template: `
    <app-sucursal-form
      idPrefijo="sucursal"
      [fotoRequerida]="false"
      [modo]="modo()"
      [valoresIniciales]="iniciales()"
      (enviar)="datos.set($event)"
    />
  `,
})
class HostFormulario {
  readonly modo = signal<'crear' | 'modificar'>('crear');
  readonly iniciales = signal<SucursalFormModel | null>(null);
  readonly datos = signal<SucursalFormDatos | null>(null);
  readonly formulario = viewChild.required(SucursalForm);
}

const DIRECCION_INICIAL = 'Av. Corrientes 1234, CABA, Argentina';
const DIRECCION_NUEVA = 'Av. Santa Fe 3253, CABA, Argentina';

const DATOS_VALIDOS: SucursalFormModel = {
  nombre: 'Sucursal Centro',
  direccion: DIRECCION_INICIAL,
  telefono: '',
  descripcion: 'Descripción de la sucursal para la prueba.',
  categoria: 'BARBERIA',
  horaApertura: '09:00',
  horaCierre: '18:00',
  diasApertura: ['MONDAY'],
};

const GEO_INICIAL = {
  latitud: -34.6037,
  longitud: -58.3816,
  googlePlaceId: 'ChIJ_inicial',
};

describe('US-MAP-04 · selector de ubicación en el formulario de sucursal', () => {
  let fixture: ComponentFixture<HostFormulario>;
  let host: HostFormulario;
  let fallo: string | null;

  const lugares = {
    iniciarSesion: vi.fn(),
    buscar: vi.fn(),
    obtenerDetalles: vi.fn(),
    estado: () => 'listo',
    fallo: () => fallo,
  };

  beforeEach(async () => {
    fallo = null;
    vi.resetAllMocks();
    lugares.iniciarSesion.mockResolvedValue({ token: 1 });
    lugares.buscar.mockResolvedValue([{ id: 'ChIJ_nuevo', descripcion: DIRECCION_NUEVA }]);
    lugares.obtenerDetalles.mockResolvedValue({
      direccion: DIRECCION_NUEVA,
      latitud: -34.5889,
      longitud: -58.3951,
      googlePlaceId: 'ChIJ_nuevo',
    });

    await TestBed.configureTestingModule({
      imports: [HostFormulario],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: sucursalService,
          useValue: {
            categoriasConId: () => of([{ id: 3, categoria: 'BARBERIA' }]),
          },
        },
        { provide: googlePlacesService, useValue: lugares },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HostFormulario);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  function raiz(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function campoDireccion(): HTMLInputElement {
    const input = raiz().querySelector<HTMLInputElement>('#sucursal-direccion');
    if (!input) throw new Error('No se encontró el campo de dirección');
    return input;
  }

  function escribir(texto: string): void {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(
      campoDireccion(),
      texto,
    );
    campoDireccion().dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
  }

  async function esperarDebounce(milisegundos = 400): Promise<void> {
    await vi.advanceTimersByTimeAsync(milisegundos);
    fixture.detectChanges();
  }

  async function buscar(texto: string): Promise<void> {
    vi.useFakeTimers();
    escribir(texto);
    await esperarDebounce();
  }

  async function elegirSugerencia(indice = 0): Promise<void> {
    const opciones = raiz().querySelectorAll<HTMLElement>('[role="option"]');
    expect(opciones.length).toBeGreaterThan(indice);
    opciones[indice].click();
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();
    vi.useRealTimers();
  }

  function enviar(): void {
    raiz()
      .querySelector<HTMLFormElement>('form.sucursal-form')!
      .dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    fixture.detectChanges();
  }

  /** Precarga el formulario en modo modificación con una ubicación vigente. */
  async function abrirEdicion(): Promise<void> {
    host.modo.set('modificar');
    host.iniciales.set({ ...DATOS_VALIDOS, ...GEO_INICIAL });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('no carga Places ni consulta al abrir el formulario', () => {
    expect(lugares.iniciarSesion).not.toHaveBeenCalled();
    expect(lugares.buscar).not.toHaveBeenCalled();
    expect(raiz().querySelector('script')).toBeNull();
  });

  it('ignora entradas demasiado cortas', async () => {
    vi.useFakeTimers();
    escribir('Ab');
    await esperarDebounce();

    expect(lugares.iniciarSesion).not.toHaveBeenCalled();
    expect(lugares.buscar).not.toHaveBeenCalled();
  });

  it('aplica debounce y consulta una sola vez el último texto', async () => {
    vi.useFakeTimers();
    escribir('Av. Corrientes');
    await esperarDebounce(100);
    escribir('Av. Corrientes 123');
    await esperarDebounce(100);
    escribir(DIRECCION_INICIAL);
    await esperarDebounce(400);

    expect(lugares.buscar).toHaveBeenCalledTimes(1);
    expect(lugares.buscar).toHaveBeenCalledWith(DIRECCION_INICIAL, { token: 1 });
    expect(lugares.iniciarSesion).toHaveBeenCalledTimes(1);

    // Repetir el mismo texto no genera otra consulta.
    escribir(DIRECCION_INICIAL);
    await esperarDebounce(400);
    expect(lugares.buscar).toHaveBeenCalledTimes(1);
  });

  it('muestra sugerencias accesibles y permite elegir con el teclado', async () => {
    await buscar(DIRECCION_INICIAL);

    const input = campoDireccion();
    expect(input.getAttribute('role')).toBe('combobox');
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(raiz().querySelector('[role="listbox"]')).toBeTruthy();

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    fixture.detectChanges();
    expect(input.getAttribute('aria-activedescendant')).toBe('sucursal-direccion-opcion-0');

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    fixture.detectChanges();
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();

    expect(lugares.obtenerDetalles).toHaveBeenCalledTimes(1);
    expect(lugares.obtenerDetalles).toHaveBeenCalledWith(
      { id: 'ChIJ_nuevo', descripcion: DIRECCION_NUEVA },
      { token: 1 },
    );
    expect(host.formulario().model().direccion).toBe(DIRECCION_NUEVA);
  });

  it('informa mientras se prepara Google Places antes de consultar sugerencias', async () => {
    vi.useFakeTimers();
    let liberarSesion: ((token: { token: number }) => void) | undefined;
    lugares.iniciarSesion.mockImplementationOnce(
      () =>
        new Promise<{ token: number }>((resolve) => {
          liberarSesion = resolve;
        }),
    );

    escribir(DIRECCION_INICIAL);
    await esperarDebounce();
    expect(raiz().textContent).toContain('Preparando la búsqueda de direcciones…');
    expect(campoDireccion().getAttribute('aria-busy')).toBe('true');

    liberarSesion!({ token: 1 });
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(0);

    expect(raiz().textContent).not.toContain('Preparando la búsqueda de direcciones…');
    expect(lugares.buscar).toHaveBeenCalledWith(DIRECCION_INICIAL, { token: 1 });
  });

  it('informa cuando no hay resultados', async () => {
    lugares.buscar.mockResolvedValue([]);
    await buscar('Calle inexistente 123');

    expect(raiz().querySelector('[role="option"]')).toBeNull();
    expect(raiz().textContent).toContain('No encontramos direcciones para esa búsqueda.');
    expect(lugares.obtenerDetalles).not.toHaveBeenCalled();
  });

  it('informa que Places no está disponible y permite reintentar', async () => {
    fallo = 'sin-api-key';
    lugares.iniciarSesion.mockRejectedValueOnce(new Error('falta la API key'));
    await buscar(DIRECCION_INICIAL);

    expect(raiz().textContent).toContain('Google Places no está disponible.');
    expect(raiz().textContent).toContain('Seguí escribiendo la dirección');
    expect(campoDireccion().disabled).toBe(false);
    const reintentar = Array.from(raiz().querySelectorAll('button')).find((boton) =>
      boton.textContent?.includes('Reintentar búsqueda'),
    );
    expect(reintentar).toBeTruthy();

    fallo = null;
    reintentar!.click();
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();

    expect(lugares.iniciarSesion).toHaveBeenCalledTimes(2);
    expect(raiz().querySelector('[role="option"]')).toBeTruthy();
  });

  it('no reemplaza los geodatos vigentes si fallan los detalles', async () => {
    await abrirEdicion();
    lugares.obtenerDetalles.mockRejectedValueOnce(new Error('falló'));
    await buscar(DIRECCION_NUEVA);
    await elegirSugerencia();

    expect(host.formulario().model().googlePlaceId).toBe('ChIJ_inicial');
    expect(raiz().textContent).toContain('No pudimos obtener los datos completos');
    enviar();
    expect(host.datos()).toBeNull();
    expect(raiz().textContent).toContain(
      'Seleccioná una dirección de las sugerencias para actualizar la ubicación.',
    );

    const reintentar = Array.from(raiz().querySelectorAll('button')).find((boton) =>
      boton.textContent?.includes('Reintentar búsqueda'),
    );
    reintentar!.click();
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();

    expect(lugares.obtenerDetalles).toHaveBeenCalledTimes(2);
    enviar();
    expect(host.datos()).toMatchObject({
      direccion: DIRECCION_NUEVA,
      latitud: -34.5889,
      longitud: -58.3951,
      googlePlaceId: 'ChIJ_nuevo',
    });
  });

  it('conserva la ubicación anterior si no se modifica la dirección', async () => {
    await abrirEdicion();
    enviar();

    expect(host.datos()).not.toBeNull();
    expect(host.datos()).toMatchObject({
      direccion: DIRECCION_INICIAL,
      latitud: null,
      longitud: null,
      googlePlaceId: null,
    });
    expect(lugares.buscar).not.toHaveBeenCalled();
  });

  it('envía dirección, coordenadas y Place ID juntos al elegir otra ubicación', async () => {
    await abrirEdicion();
    await buscar(DIRECCION_NUEVA);
    await elegirSugerencia();
    enviar();

    expect(host.datos()).toMatchObject({
      direccion: DIRECCION_NUEVA,
      latitud: -34.5889,
      longitud: -58.3951,
      googlePlaceId: 'ChIJ_nuevo',
    });
  });

  it('no guarda coordenadas de otra dirección si el texto se modifica después', async () => {
    await abrirEdicion();
    await buscar(DIRECCION_NUEVA);
    await elegirSugerencia();
    vi.useRealTimers();

    // Se escribe una dirección distinta sin elegir una sugerencia nueva.
    escribir('Calle Inventada 987');
    enviar();

    expect(host.datos()).toBeNull();
    expect(raiz().textContent).toContain(
      'Seleccioná una dirección de las sugerencias para actualizar la ubicación.',
    );
  });

  it('recupera la ubicación inicial al volver a la dirección anterior', async () => {
    await abrirEdicion();
    await buscar(DIRECCION_NUEVA);
    await elegirSugerencia();
    vi.useRealTimers();

    escribir(DIRECCION_INICIAL);
    enviar();

    expect(host.datos()).toMatchObject({
      direccion: DIRECCION_INICIAL,
      latitud: null,
      longitud: null,
      googlePlaceId: null,
    });
  });
});
