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
    api.crear.mockReturnValue(of({ id: 1, nombre: 'Corte' } as any));
    page.model.set({ nombre: 'Corte', descripcion: 'desc', duracion: 30, precio: 100, fotoPerfil: '' });
    fixture.detectChanges();
    page.onSubmit(new Event('submit', { cancelable: true }));
    expect(api.crear).toHaveBeenCalledWith(expect.objectContaining({ sucursalId: 5, nombre: 'Corte', duracion: 30 }));
    expect(page.exito()).toBeTruthy();
  });

  it('muestra error si falla la creación', () => {
    api.crear.mockReturnValue(throwError(() => ({ error: { message: 'Nombre duplicado' } })));
    page.model.set({ nombre: 'Corte', descripcion: '', duracion: 30, precio: null, fotoPerfil: '' });
    fixture.detectChanges();
    page.onSubmit(new Event('submit', { cancelable: true }));
    expect(page.error()).toBe('Nombre duplicado');
  });

  it('conserva los valores ingresados ante error', () => {
    api.crear.mockReturnValue(throwError(() => new Error('fail')));
    page.model.set({ nombre: 'Corte', descripcion: 'desc', duracion: 30, precio: 100, fotoPerfil: '' });
    fixture.detectChanges();
    page.onSubmit(new Event('submit', { cancelable: true }));
    expect(page.model().nombre).toBe('Corte');
    expect(page.model().descripcion).toBe('desc');
  });
});
