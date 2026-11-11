import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { SucursalDetalleDTO } from '../../models/sucursal';
import { sucursalService } from '../../services/sucursal-service';
import { EditarSucursalPage } from './editar-sucursal';

describe('Editar sucursal', () => {
  let fixture: ComponentFixture<EditarSucursalPage>;
  let page: EditarSucursalPage;
  const api = { obtenerPorId: vi.fn(), actualizar: vi.fn() };
  const route = { snapshot: { paramMap: { get: (key: string) => key === 'sucursalId' ? '5' : null } } };
  const sucursal: SucursalDetalleDTO = {
    id: 5, nombre: 'Sucursal Centro', direccion: 'Av. Corrientes 1234', telefono: '1122334455',
    descripcion: 'Sucursal principal de atención', fechaCreacion: null, categoria: 'Belleza',
    horaApertura: '09:00', horaCierre: '18:00', diasApertura: null,
    puntuacion: null, cantidadPuntuaciones: null, fotoPerfil: 'https://example.com/foto.jpg',
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    api.obtenerPorId.mockReturnValue(of(sucursal));
    await TestBed.configureTestingModule({
      imports: [EditarSucursalPage],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: route },
        { provide: sucursalService, useValue: api },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(EditarSucursalPage);
    page = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => TestBed.resetTestingModule());

  it('precarga los datos existentes de la sucursal', () => {
    expect(api.obtenerPorId).toHaveBeenCalledWith(5, true);
    expect(page.model().nombre).toBe('Sucursal Centro');
    expect(page.model().horaApertura).toBe('09:00');
  });

  it('valida antes de llamar a la API y conserva el formulario', () => {
    page.model.update(value => ({ ...value, direccion: 'x' }));
    page.onSubmit(new Event('submit', { cancelable: true }));
    expect(api.actualizar).not.toHaveBeenCalled();
    expect(page.model().nombre).toBe('Sucursal Centro');
  });

  it('guarda datos editados y comunica el éxito', () => {
    api.actualizar.mockReturnValue(of('Sucursal modificada'));
    page.model.update(value => ({ ...value, nombre: 'Sucursal Norte' }));
    page.onSubmit(new Event('submit', { cancelable: true }));
    expect(api.actualizar).toHaveBeenCalledWith(5, expect.objectContaining({ nombre: 'Sucursal Norte' }));
    expect(page.exito()).toContain('actualizada correctamente');
  });

  it('muestra error inline y conserva los cambios ante fallo del servidor', () => {
    api.actualizar.mockReturnValue(throwError(() => new Error('fallo')));
    page.model.update(value => ({ ...value, nombre: 'Sucursal Norte' }));
    page.onSubmit(new Event('submit', { cancelable: true }));
    expect(page.error()).toContain('No pudimos guardar');
    expect(page.model().nombre).toBe('Sucursal Norte');
  });

  it('solicita confirmación antes de descartar cambios', () => {
    page.model.update(value => ({ ...value, nombre: 'Sucursal Norte' }));
    page.cancelar();
    expect(page.confirmarDescarte()).toBe(true);
  });
});
