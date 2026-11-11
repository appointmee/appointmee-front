import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { authService } from '../../services/auth-service';
import { usuarioService } from '../../services/usuario-service';
import { PerfilPage } from './perfil';

describe('Mi perfil', () => {
  let fixture: ComponentFixture<PerfilPage>;
  let page: PerfilPage;
  const api = { obtenerPorId: vi.fn(), actualizar: vi.fn(), eliminarFotoPerfil: vi.fn() };
  const auth = {
    perfil: signal({ id: 7, roles: ['CLIENTE'], fotoPerfil: 'https://example.com/ana.jpg', email: 'ana@example.com' }),
    actualizarFotoPerfil: vi.fn(),
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    auth.perfil.set({ id: 7, roles: ['CLIENTE'], fotoPerfil: 'https://example.com/ana.jpg', email: 'ana@example.com' });
    api.obtenerPorId.mockReturnValue(of({
      id: 7, nombre: 'Ana', apellido: 'García', email: 'ana@example.com', urlFotoPerfil: 'https://example.com/ana.jpg',
    }));
    await TestBed.configureTestingModule({
      imports: [PerfilPage],
      providers: [provideRouter([]), { provide: usuarioService, useValue: api }, { provide: authService, useValue: auth }],
    }).compileComponents();
    fixture = TestBed.createComponent(PerfilPage);
    page = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => TestBed.resetTestingModule());

  it('carga los datos del usuario autenticado', () => {
    expect(api.obtenerPorId).toHaveBeenCalledWith(7);
    expect(page.model()).toMatchObject({ nombre: 'Ana', apellido: 'García', email: 'ana@example.com' });
  });

  it('valida nombre/email antes de guardar', () => {
    page.model.update(model => ({ ...model, email: 'no-es-email' }));
    page.onSubmit(new Event('submit', { cancelable: true }));
    expect(api.actualizar).not.toHaveBeenCalled();
  });

  it('guarda y comunica el éxito sin perder los datos', () => {
    api.actualizar.mockReturnValue(of('Usuario modificado'));
    page.model.update(model => ({ ...model, nombre: 'Ana María' }));
    page.onSubmit(new Event('submit', { cancelable: true }));
    expect(api.actualizar).toHaveBeenCalledWith(7, expect.objectContaining({ nombre: 'Ana María' }));
    expect(page.exito()).toContain('actualizó correctamente');
  });

  it('muestra error inline y conserva los valores cuando falla el servidor', () => {
    api.actualizar.mockReturnValue(throwError(() => new Error('fallo')));
    page.model.update(model => ({ ...model, nombre: 'Ana María' }));
    page.onSubmit(new Event('submit', { cancelable: true }));
    expect(page.error()).toContain('No pudimos guardar');
    expect(page.model().nombre).toBe('Ana María');
  });

  it('permite eliminar la foto y vuelve al avatar predeterminado', () => {
    api.eliminarFotoPerfil.mockReturnValue(of('Se eliminó la foto'));
    page.eliminarFoto();
    expect(api.eliminarFotoPerfil).toHaveBeenCalledOnce();
    expect(page.model().fotoUrl).toBe('');
    expect(auth.actualizarFotoPerfil).toHaveBeenCalledWith(null);
    expect(page.exito()).toContain('avatar predeterminado');
  });
});
