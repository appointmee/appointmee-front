import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { ServicioDTO } from '../../models/servicio';
import { servicioService } from '../../services/servicio-service';
import { GestionarServiciosPage } from './gestionar-servicios';

describe('Administrar servicios', () => {
  let fixture: ComponentFixture<GestionarServiciosPage>;
  let page: GestionarServiciosPage;
  const api = { listarPorSucursal: vi.fn(), eliminar: vi.fn() };
  const route = { snapshot: { paramMap: { get: (name: string) => name === 'sucursalId' ? '12' : null } } };
  const servicios: ServicioDTO[] = [
    { id: 3, nombre: 'Corte clásico', descripcion: 'Corte tradicional', duracion: 30, precio: 2000, fotoPerfil: null, puntuacion: null, cantidadPuntuaciones: 0 },
    { id: 4, nombre: 'Barba', descripcion: 'Perfilado de barba', duracion: 30, precio: 1000, fotoPerfil: null, puntuacion: null, cantidadPuntuaciones: 0 },
  ];

  beforeEach(async () => {
    vi.resetAllMocks();
    api.listarPorSucursal.mockReturnValue(of(servicios));
    await TestBed.configureTestingModule({
      imports: [GestionarServiciosPage],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: route },
        { provide: servicioService, useValue: api },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(GestionarServiciosPage);
    page = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => TestBed.resetTestingModule());

  it('carga y presenta los servicios de la sucursal de la ruta', () => {
    expect(api.listarPorSucursal).toHaveBeenCalledWith(12);
    expect(page.servicios()).toHaveLength(2);
  });

  it('pide confirmación antes de eliminar', () => {
    page.pedirConfirmacion(servicios[0]);
    expect(page.pendiente()).toEqual(servicios[0]);
    expect(api.eliminar).not.toHaveBeenCalled();
  });

  it('cancela la eliminación sin invocar el backend', () => {
    page.pedirConfirmacion(servicios[0]);
    page.cancelar();
    expect(page.pendiente()).toBeNull();
    expect(api.eliminar).not.toHaveBeenCalled();
  });

  it('elimina y actualiza el listado con feedback de éxito', () => {
    api.eliminar.mockReturnValue(of('Se eliminó'));
    page.pedirConfirmacion(servicios[0]);
    page.confirmar();
    expect(api.eliminar).toHaveBeenCalledWith(3);
    expect(page.servicios().map(item => item.id)).toEqual([4]);
    expect(page.exito()).toContain('Corte clásico');
  });

  it('muestra error inline y conserva el servicio si falla la petición', () => {
    api.eliminar.mockReturnValue(throwError(() => new Error('offline')));
    page.pedirConfirmacion(servicios[0]);
    page.confirmar();
    expect(page.servicios()).toHaveLength(2);
    expect(page.error()).toContain('No pudimos eliminar');
  });

  it('muestra opción de reintento si no puede cargar el listado', () => {
    api.listarPorSucursal.mockReturnValue(throwError(() => new Error('offline')));
    page.cargar();
    expect(page.error()).toContain('No pudimos cargar');
    api.listarPorSucursal.mockReturnValue(of([servicios[1]]));
    page.cargar();
    expect(page.servicios()).toEqual([servicios[1]]);
  });
});
