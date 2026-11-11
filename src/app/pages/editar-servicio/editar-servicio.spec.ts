import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { EditarServicioPage } from './editar-servicio';
import { servicioService } from '../../services/servicio-service';

@Component({ template: '' })
class DummyPage {}

describe('Editar servicio', () => {
  let fixture: ComponentFixture<EditarServicioPage>;
  let page: EditarServicioPage;
  const api = { obtenerPorId: vi.fn(), actualizar: vi.fn() };
  const route = { snapshot: { paramMap: { get: (k: string) => (k === 'servicioId' ? '9' : k === 'sucursalId' ? '5' : null) } } };

  beforeEach(async () => {
    TestBed.resetTestingModule();
    vi.resetAllMocks();
    api.obtenerPorId.mockReturnValue(of({ id: 9, nombre: 'Corte', descripcion: 'Descripción clásica', duracion: 30, precio: 100, fotoPerfil: 'http://x' }));
    await TestBed.configureTestingModule({
      imports: [EditarServicioPage],
      providers: [
        provideRouter([{ path: 'mis-sucursales', component: DummyPage }]),
        { provide: servicioService, useValue: api },
        { provide: ActivatedRoute, useValue: route },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(EditarServicioPage);
    page = fixture.componentInstance;
    fixture.detectChanges();
  });
  afterEach(() => TestBed.resetTestingModule());

  it('precarga los datos del servicio', () => {
    expect(page.model().nombre).toBe('Corte');
    expect(page.model().duracion).toBe(30);
    expect(page.original()?.nombre).toBe('Corte');
  });

  it('bloquea el envío cuando el nombre no cumple la validación', () => {
    page.model.set({ nombre: '', descripcion: 'Descripción clásica', duracion: 30, precio: 100, fotoPerfil: '' });
    page.onSubmit(new Event('submit', { cancelable: true }));
    expect(api.actualizar).not.toHaveBeenCalled();
  });

  it('envía los cambios actualizados', () => {
    api.actualizar.mockReturnValue(of({ id: 9, nombre: 'Corte XL' } as any));
    page.model.set({ nombre: 'Corte XL', descripcion: 'Descripción clásica', duracion: 45, precio: 120, fotoPerfil: 'http://x' });
    fixture.detectChanges();
    page.onSubmit(new Event('submit', { cancelable: true }));
    expect(api.actualizar).toHaveBeenCalledWith(9, expect.objectContaining({ nombre: 'Corte XL', duracion: 45 }));
    expect(page.exito()).toBeTruthy();
  });

  it('muestra error si falla la actualización', () => {
    api.actualizar.mockReturnValue(throwError(() => ({ error: { message: 'detalle interno' } })));
    page.model.set({ nombre: 'Corte', descripcion: 'Descripción clásica', duracion: 30, precio: 100, fotoPerfil: '' });
    fixture.detectChanges();
    page.onSubmit(new Event('submit', { cancelable: true }));
    expect(page.error()).toContain('No pudimos actualizar');
  });

  it('pide confirmación al cancelar con cambios', () => {
    page.model.set({ nombre: 'Cambiado', descripcion: 'Descripción clásica', duracion: 30, precio: 100, fotoPerfil: '' });
    fixture.detectChanges();
    page.cancelar();
    expect(page.confirmarDescarte()).toBe(true);
  });

  it('no pide confirmación al cancelar sin cambios', () => {
    page.cancelar();
    expect(page.confirmarDescarte()).toBe(false);
  });

  it('descarta cambios al confirmar', () => {
    page.model.set({ nombre: 'Cambiado', descripcion: 'Descripción clásica', duracion: 30, precio: 100, fotoPerfil: '' });
    fixture.detectChanges();
    page.cancelar();
    page.confirmarDescartar();
    expect(page.confirmarDescarte()).toBe(false);
  });
});
