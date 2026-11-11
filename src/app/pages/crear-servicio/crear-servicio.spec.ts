import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { CrearServicioPage } from './crear-servicio';
import { servicioService } from '../../services/servicio-service';

@Component({ template: '' })
class DummyPage {}

describe('Crear servicio', () => {
  let fixture: ComponentFixture<CrearServicioPage>;
  let page: CrearServicioPage;
  const api = { crear: vi.fn() };
  const route = { snapshot: { paramMap: { get: (k: string) => (k === 'sucursalId' ? '5' : null) } } };

  beforeEach(async () => {
    TestBed.resetTestingModule();
    vi.resetAllMocks();
    await TestBed.configureTestingModule({
      imports: [CrearServicioPage],
      providers: [
        provideRouter([{ path: 'mis-sucursales', component: DummyPage }]),
        { provide: servicioService, useValue: api },
        { provide: ActivatedRoute, useValue: route },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(CrearServicioPage);
    page = fixture.componentInstance;
    fixture.detectChanges();
  });
  afterEach(() => TestBed.resetTestingModule());

  function completarFormulario(): void {
    page.model.set({
      nombre: 'Corte clásico', descripcion: 'Corte de cabello tradicional', duracion: 30,
      precio: 1000, fotoPerfil: 'https://example.com/servicio.jpg',
    });
    fixture.detectChanges();
  }

  it('no envía el formulario si el nombre está vacío', () => {
    page.onSubmit(new Event('submit', { cancelable: true }));
    expect(api.crear).not.toHaveBeenCalled();
  });

  it('valida la duración', () => {
    page.model.set({ nombre: 'Corte', descripcion: '', duracion: 0, precio: null, fotoPerfil: '' });
    page.onSubmit(new Event('submit', { cancelable: true }));
    expect(api.crear).not.toHaveBeenCalled();
  });

  it('envía los datos y redirige al éxito', async () => {
    api.crear.mockReturnValue(of('Se creó el servicio'));
    completarFormulario();
    page.onSubmit(new Event('submit', { cancelable: true }));
    expect(api.crear).toHaveBeenCalledWith(expect.objectContaining({ sucursalId: 5, nombre: 'Corte clásico', duracion: 30, precio: 1000, fotoPerfil: 'https://example.com/servicio.jpg' }));
    expect(page.exito()).toBeTruthy();
  });

  it('muestra error si falla la creación', () => {
    api.crear.mockReturnValue(throwError(() => ({ error: { message: 'backend detail' } })));
    completarFormulario();
    page.onSubmit(new Event('submit', { cancelable: true }));
    expect(page.error()).toContain('No pudimos crear');
  });

  it('conserva los valores ingresados ante error', () => {
    api.crear.mockReturnValue(throwError(() => new Error('fail')));
    completarFormulario();
    page.onSubmit(new Event('submit', { cancelable: true }));
    expect(page.model().nombre).toBe('Corte clásico');
    expect(page.model().descripcion).toBe('Corte de cabello tradicional');
  });
});
