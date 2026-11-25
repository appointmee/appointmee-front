import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { CrearSucursalPage } from './crear-sucursal';
import { googlePlacesService } from '../../services/google-places-service';
import { sucursalService } from '../../services/sucursal-service';

@Component({ template: '' })
class DummyPage {}

describe('Crear sucursal', () => {
  let fixture: ComponentFixture<CrearSucursalPage>;
  let page: CrearSucursalPage;
  const api = {
    crear: vi.fn(),
    categorias: vi.fn(),
    categoriasConId: vi.fn(),
  };
  const lugares = {
    iniciarSesion: vi.fn(),
    buscar: vi.fn(),
    obtenerDetalles: vi.fn(),
    estado: () => 'listo',
    fallo: () => null,
  };

  beforeEach(async () => {
    TestBed.resetTestingModule();
    vi.resetAllMocks();
    api.categorias.mockReturnValue(of(['PELUQUERIA']));
    api.categoriasConId.mockReturnValue(of([{ id: 1, categoria: 'PELUQUERIA' }]));
    api.crear.mockReturnValue(of('Se creó la sucursal'));
    lugares.iniciarSesion.mockResolvedValue({ token: 1 });
    lugares.buscar.mockResolvedValue([
      { id: 'ChIJ_prueba', descripcion: 'Calle Falsa 123, CABA, Argentina' },
    ]);
    lugares.obtenerDetalles.mockResolvedValue({
      direccion: 'Calle Falsa 123, CABA, Argentina',
      latitud: -34.6037,
      longitud: -58.3816,
      googlePlaceId: 'ChIJ_prueba',
    });

    await TestBed.configureTestingModule({
      imports: [CrearSucursalPage],
      providers: [
        provideRouter([{ path: 'mis-sucursales', component: DummyPage }]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: sucursalService, useValue: api },
        { provide: googlePlacesService, useValue: lugares },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(CrearSucursalPage);
    page = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  function escribir(id: string, valor: string): void {
    const control = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(`#${id}`);
    if (!control) throw new Error(`No se encontró el control ${id}`);
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(control, valor);
    control.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
  }

  /** Escribe una dirección, espera el debounce y elige la sugerencia simulada. */
  async function elegirUbicacion(): Promise<void> {
    vi.useFakeTimers();
    escribir('sucursal-crear-direccion', 'Calle Falsa 123');
    await vi.advanceTimersByTimeAsync(400);
    fixture.detectChanges();

    const opcion = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('[role="option"]');
    expect(opcion).toBeTruthy();
    opcion!.click();
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();
    vi.useRealTimers();
  }

  function completarFormulario(): void {
    page.model.set({
      nombre: 'Nueva sucursal',
      direccion: 'Calle Falsa 123',
      telefono: '',
      descripcion: 'Descripción de prueba',
      categoria: 'PELUQUERIA',
      horaApertura: '09:00',
      horaCierre: '18:00',
      diasApertura: ['MONDAY'],
    });
    page.fotoUrl.set('https://res.cloudinary.com/x.jpg');
    fixture.detectChanges();
  }

  it('organiza el alta en secciones de información, horarios e imagen', () => {
    const formulario = fixture.nativeElement.querySelector('form.sucursal-form') as HTMLFormElement;
    expect(formulario).not.toBeNull();
    expect(formulario.querySelectorAll('.seccion')).toHaveLength(3);
    expect(formulario.textContent).toContain('Información de la sucursal');
    expect(formulario.textContent).toContain('Horarios de atención');
    expect(formulario.textContent).toContain('Imagen principal');
    expect(formulario.querySelector('label[for="sucursal-crear-foto"]')?.textContent)
      .toContain('Foto de la sucursal');
  });

  it('no envía el formulario si el nombre está vacío', () => {
    page.onSubmit(new Event('submit', { cancelable: true }));
    expect(api.crear).not.toHaveBeenCalled();
  });

  it('abre el selector visual de hora y aplica hora y minutos elegidos', async () => {
    const root = fixture.nativeElement as HTMLElement;
    const abrir = root.querySelector('#sucursal-crear-horaApertura-selector-trigger') as HTMLButtonElement;
    abrir.click();
    fixture.detectChanges();
    await fixture.whenStable();

    const selector = root.querySelector('#sucursal-crear-horaApertura-selector') as HTMLElement;
    const [hora, minuto] = Array.from(selector.querySelectorAll('select')) as HTMLSelectElement[];
    expect(selector.getAttribute('role')).toBe('dialog');
    expect(hora.options).toHaveLength(24);
    expect(minuto.options).toHaveLength(60);

    hora.value = '10';
    hora.dispatchEvent(new Event('change'));
    minuto.value = '30';
    minuto.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    Array.from(selector.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Aplicar hora'))!.click();
    fixture.detectChanges();

    expect(page.model().horaApertura).toBe('10:30');
    expect(root.querySelector('#sucursal-crear-horaApertura-selector')).toBeNull();
    expect(abrir.textContent).toContain('10:30');
  });

  it('no envía el alta sin una ubicación seleccionada', () => {
    completarFormulario();
    page.onSubmit(new Event('submit', { cancelable: true }));
    fixture.detectChanges();

    expect(api.crear).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain(
      'Seleccioná una dirección de las sugerencias para guardar la ubicación.',
    );
  });

  it('envía la dirección formateada con latitud, longitud y Place ID', async () => {
    completarFormulario();
    await elegirUbicacion();
    page.onSubmit(new Event('submit', { cancelable: true }));

    expect(api.crear).toHaveBeenCalledTimes(1);
    expect(api.crear).toHaveBeenCalledWith(
      expect.objectContaining({
        direccion: 'Calle Falsa 123, CABA, Argentina',
        latitud: -34.6037,
        longitud: -58.3816,
        googlePlaceId: 'ChIJ_prueba',
      }),
    );
  });

  it('muestra error si falla la creación', async () => {
    api.crear.mockReturnValue(throwError(() => new Error('fail')));
    completarFormulario();
    await elegirUbicacion();
    page.onSubmit(new Event('submit', { cancelable: true }));

    expect(page.error()).toBeTruthy();
  });
});
