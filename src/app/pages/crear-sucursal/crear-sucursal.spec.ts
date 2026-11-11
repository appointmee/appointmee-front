import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { CrearSucursalPage } from './crear-sucursal';
import { sucursalService } from '../../services/sucursal-service';

@Component({ template: '' })
class DummyPage {}

describe('Crear sucursal', () => {
  let fixture: ComponentFixture<CrearSucursalPage>;
  let page: CrearSucursalPage;
  const api = { crear: vi.fn() };

  beforeEach(async () => {
    TestBed.resetTestingModule();
    vi.resetAllMocks();
    await TestBed.configureTestingModule({
      imports: [CrearSucursalPage],
      providers: [
        provideRouter([{ path: 'mis-sucursales', component: DummyPage }]),
        { provide: sucursalService, useValue: api },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(CrearSucursalPage);
    page = fixture.componentInstance;
    fixture.detectChanges();
  });
  afterEach(() => TestBed.resetTestingModule());

  it('no envía el formulario si el nombre está vacío', () => {
    page.onSubmit(new Event('submit', { cancelable: true }));
    expect(api.crear).not.toHaveBeenCalled();
  });

  it('envía los datos y navega al éxito', async () => {
    api.crear.mockReturnValue(of({ id: 1, nombre: 'Nueva' } as any));
    page.model.set({
      nombre: 'Nueva',
      direccion: '',
      telefono: '',
      descripcion: '',
      categoria: '',
      horaApertura: '',
      horaCierre: '',
    });
    fixture.detectChanges();
    page.onSubmit(new Event('submit', { cancelable: true }));
    expect(api.crear).toHaveBeenCalled();
  });

  it('muestra error si falla la creación', () => {
    api.crear.mockReturnValue(throwError(() => new Error('fail')));
    page.model.set({
      nombre: 'Nueva',
      direccion: '',
      telefono: '',
      descripcion: '',
      categoria: '',
      horaApertura: '',
      horaCierre: '',
    });
    fixture.detectChanges();
    page.onSubmit(new Event('submit', { cancelable: true }));
    expect(page.error()).toBeTruthy();
  });
});
