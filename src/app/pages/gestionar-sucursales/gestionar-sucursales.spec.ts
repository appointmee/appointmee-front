import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { SucursalMiniDTO } from '../../models/sucursal';
import { authService } from '../../services/auth-service';
import { sucursalService } from '../../services/sucursal-service';
import { GestionarSucursalesPage } from './gestionar-sucursales';

describe('Eliminar sucursales', () => {
  let fixture: ComponentFixture<GestionarSucursalesPage>;
  let page: GestionarSucursalesPage;
  const roles = signal<string[]>([]);
  const api = { listar: vi.fn(), listarPropias: vi.fn(), eliminar: vi.fn(), eliminarPropia: vi.fn() };
  const auth = { tieneAlgunRol: vi.fn((...expected: string[]) => expected.some(role => roles().includes(role))) };
  const sucursales: SucursalMiniDTO[] = [
    { id: 7, nombre: 'Sucursal Centro', categoria: 'BARBERIA', fotoPerfil: null, puntuacion: null, cantidadPuntuaciones: 0 },
    { id: 8, nombre: 'Sucursal Norte', categoria: 'BELLEZA', fotoPerfil: null, puntuacion: null, cantidadPuntuaciones: 0 },
  ];

  beforeEach(async () => {
    vi.resetAllMocks();
    roles.set(['EMPLEADOR']);
    auth.tieneAlgunRol.mockImplementation((...expected: string[]) => expected.some(role => roles().includes(role)));
    api.listarPropias.mockReturnValue(of(sucursales));
    api.listar.mockReturnValue(of(sucursales));
    await TestBed.configureTestingModule({
      imports: [GestionarSucursalesPage],
      providers: [provideRouter([]), { provide: sucursalService, useValue: api }, { provide: authService, useValue: auth }],
    }).compileComponents();
    fixture = TestBed.createComponent(GestionarSucursalesPage);
    page = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => TestBed.resetTestingModule());

  it('carga únicamente las sucursales propias para empleador', () => {
    expect(api.listarPropias).toHaveBeenCalledOnce();
    expect(api.listar).not.toHaveBeenCalled();
    expect(page.sucursales()).toHaveLength(2);
  });

  it('pide confirmación y permite cancelar sin borrar', () => {
    page.pedirConfirmacion(sucursales[0]);
    expect(page.pendiente()).toEqual(sucursales[0]);
    page.cancelar();
    expect(page.pendiente()).toBeNull();
    expect(api.eliminarPropia).not.toHaveBeenCalled();
  });

  it('empleador elimina por el endpoint de sucursal propia y actualiza el listado', () => {
    api.eliminarPropia.mockReturnValue(of('Se eliminó la sucursal'));
    page.pedirConfirmacion(sucursales[0]);
    page.confirmar();
    expect(api.eliminarPropia).toHaveBeenCalledWith(7);
    expect(api.eliminar).not.toHaveBeenCalled();
    expect(page.sucursales().map(s => s.id)).toEqual([8]);
    expect(page.exito()).toContain('Sucursal Centro');
  });

  it('administrador carga y elimina desde los endpoints administrativos', () => {
    roles.set(['ADMINISTRADOR']);
    page.cargar();
    expect(api.listar).toHaveBeenCalledWith(true);
    api.eliminar.mockReturnValue(of('Se eliminó la sucursal'));
    page.pedirConfirmacion(sucursales[0]);
    page.confirmar();
    expect(api.eliminar).toHaveBeenCalledWith(7);
    expect(api.eliminarPropia).not.toHaveBeenCalled();
  });

  it('conserva el listado y muestra error inline si la eliminación falla', () => {
    api.eliminarPropia.mockReturnValue(throwError(() => new Error('fallo')));
    page.pedirConfirmacion(sucursales[0]);
    page.confirmar();
    expect(page.sucursales()).toHaveLength(2);
    expect(page.error()).toContain('No pudimos eliminar');
  });

  it('permite reintentar la carga del listado', () => {
    api.listarPropias.mockReturnValueOnce(throwError(() => new Error('offline'))).mockReturnValueOnce(of(sucursales));
    page.cargar();
    expect(page.error()).toContain('No pudimos cargar');
    page.cargar();
    expect(page.sucursales()).toEqual(sucursales);
    expect(page.error()).toBeNull();
  });
});
