import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { CrearSucursalPage } from './crear-sucursal';
import { sucursalService } from '../../services/sucursal-service';

@Component({ template: '' })
class DummyPage {}

describe('Crear sucursal', () => {
  let fixture: ComponentFixture<CrearSucursalPage>;
  let page: CrearSucursalPage;
  const api = {
    crear: vi.fn(),
    categorias: vi.fn(() => of(['PELUQUERIA'])),
    categoriasConId: vi.fn(() => of([{ id: 1, categoria: 'PELUQUERIA' }])),
  };

  beforeEach(async () => {
    TestBed.resetTestingModule();
    vi.resetAllMocks();
    api.categorias.mockReturnValue(of(['PELUQUERIA']));
    api.categoriasConId.mockReturnValue(of([{ id: 1, categoria: 'PELUQUERIA' }]));
    await TestBed.configureTestingModule({
      imports: [CrearSucursalPage],
      providers: [
        provideRouter([{ path: 'mis-sucursales', component: DummyPage }]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: sucursalService, useValue: api },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(CrearSucursalPage);
    page = fixture.componentInstance;
    fixture.detectChanges();
  });
  afterEach(() => TestBed.resetTestingModule());

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

  it('envía los datos y navega al éxito', async () => {
    api.crear.mockReturnValue(of({ id: 1, nombre: 'Nueva' } as any));
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
    page.onSubmit(new Event('submit', { cancelable: true }));
    expect(api.crear).toHaveBeenCalled();
  });

  it('muestra error si falla la creación', () => {
    api.crear.mockReturnValue(throwError(() => new Error('fail')));
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
    page.onSubmit(new Event('submit', { cancelable: true }));
    expect(page.error()).toBeTruthy();
  });
});
