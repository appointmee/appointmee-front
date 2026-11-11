import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { UsuarioPerfilAdminDTO } from '../../models/usuario';
import { AdminUsuarios } from './admin-usuarios';

const USUARIOS = [
  { id: 1, nombre: 'Ana', apellido: 'Pérez', estado: true },
  { id: 2, nombre: 'Bruno', apellido: 'Gómez', estado: false },
];

function perfil(id: number): UsuarioPerfilAdminDTO {
  return {
    id,
    nombre: id === 1 ? 'Ana' : 'Bruno',
    apellido: id === 1 ? 'Pérez' : 'Gómez',
    email: `user${id}@example.com`,
    fechaCreacion: '2026-01-01',
    fotoPerfil: null,
    roles: ['CLIENTE'],
    sucursalesEmpleado: [],
  };
}

describe('AdminUsuarios · gestión de usuarios', () => {
  let fixture: ComponentFixture<AdminUsuarios>;
  let backend: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminUsuarios],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminUsuarios);
    fixture.detectChanges();
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    fixture.destroy();
    backend.verify();
  });

  function listar() {
    return backend.expectOne((req) => req.url.endsWith('/usuarios/listar'));
  }

  it('lista usuarios y muestra contadores/estados', () => {
    listar().flush(USUARIOS);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('Ana Pérez');
    expect(host.textContent).toContain('Bruno Gómez');
    expect(host.textContent).toContain('2 usuarios');
    expect(host.textContent).toContain('Activo');
    expect(host.textContent).toContain('Inactivo');
  });

  it('aplica filtros y consulta el endpoint de filtrado', () => {
    listar().flush(USUARIOS);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    (host.querySelector('#filtro-nombre') as HTMLInputElement).value = 'Ana';
    host.querySelector('#filtro-nombre')?.dispatchEvent(new Event('input'));
    (host.querySelector('#filtro-activo') as HTMLSelectElement).value = 'activos';
    host.querySelector('#filtro-activo')?.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    host.querySelector<HTMLButtonElement>('form button[type="submit"]')?.click();
    fixture.detectChanges();

    const req = backend.expectOne((r) => r.url.endsWith('/usuarios/listar/filtrar'));
    expect(req.request.params.get('nombre')).toBe('Ana');
    expect(req.request.params.get('activo')).toBe('true');
    req.flush([USUARIOS[0]]);
    fixture.detectChanges();

    expect(host.textContent).toContain('Ana Pérez');
    expect(host.textContent).not.toContain('Bruno Gómez');
  });

  it('muestra estado vacío cuando no hay usuarios', () => {
    listar().flush([]);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('No se encontraron usuarios');
  });

  it('muestra error inline de carga y permite reintentar', () => {
    listar().flush({}, { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('No pudimos cargar los usuarios');

    host.querySelector<HTMLButtonElement>('.estado--error button')?.click();
    fixture.detectChanges();

    listar().flush([USUARIOS[0]]);
    fixture.detectChanges();

    expect(host.textContent).toContain('Ana Pérez');
  });

  it('carga y muestra el detalle de un usuario', () => {
    listar().flush([USUARIOS[0]]);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const botones = host.querySelectorAll<HTMLButtonElement>('.usuario-resumen__acciones button');
    (Array.from(botones).find((b) => b.textContent?.includes('Ver detalle')) as HTMLButtonElement).click();
    fixture.detectChanges();

    const req = backend.expectOne((r) => r.url.endsWith('/usuarios/1'));
    expect(req.request.method).toBe('GET');
    req.flush(perfil(1));
    fixture.detectChanges();

    expect(host.textContent).toContain('user1@example.com');
    expect(host.textContent).toContain('CLIENTE');
  });

  it('muestra error inline al cargar detalle y permite reintentar', () => {
    listar().flush([USUARIOS[0]]);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const botones = host.querySelectorAll<HTMLButtonElement>('.usuario-resumen__acciones button');
    (Array.from(botones).find((b) => b.textContent?.includes('Ver detalle')) as HTMLButtonElement).click();
    fixture.detectChanges();

    backend.expectOne((r) => r.url.endsWith('/usuarios/1')).flush({}, { status: 500, statusText: 'Error' });
    fixture.detectChanges();
    expect(host.textContent).toContain('Ocurrió un error inesperado');

    (Array.from(host.querySelectorAll<HTMLButtonElement>('.detalle button')).find((b) => b.textContent?.includes('Reintentar')) as HTMLButtonElement).click();
    fixture.detectChanges();
    backend.expectOne((r) => r.url.endsWith('/usuarios/1')).flush(perfil(1));
    fixture.detectChanges();

    expect(host.textContent).toContain('user1@example.com');
  });

  it('elimina un usuario tras confirmación y actualiza la lista', () => {
    listar().flush(USUARIOS);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const botones = Array.from(host.querySelectorAll<HTMLButtonElement>('.usuario-resumen__acciones button'));
    (botones.find((b) => b.textContent?.includes('Eliminar')) as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(host.textContent).toContain('Confirmar eliminación');

    (Array.from(host.querySelectorAll<HTMLButtonElement>('.confirmacion__acciones button')).find((b) => b.textContent?.includes('Confirmar eliminación')) as HTMLButtonElement).click();
    fixture.detectChanges();

    const req = backend.expectOne((r) => r.url.endsWith('/usuarios/eliminar/1'));
    expect(req.request.method).toBe('DELETE');
    req.flush('Se eliminó al usuario');
    fixture.detectChanges();

    expect(host.textContent).not.toContain('Ana Pérez');
    expect(host.textContent).toContain('El usuario fue eliminado correctamente.');
  });

  it('muestra error inline si falla la eliminación y permite reintentar', () => {
    listar().flush([USUARIOS[0]]);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    (Array.from(host.querySelectorAll<HTMLButtonElement>('.usuario-resumen__acciones button')).find((b) => b.textContent?.includes('Eliminar')) as HTMLButtonElement).click();
    fixture.detectChanges();
    (Array.from(host.querySelectorAll<HTMLButtonElement>('.confirmacion__acciones button')).find((b) => b.textContent?.includes('Confirmar eliminación')) as HTMLButtonElement).click();
    fixture.detectChanges();

    backend.expectOne((r) => r.url.endsWith('/usuarios/eliminar/1')).flush('No se pudo', { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();

    expect(host.textContent).toContain('No se pudo');
    expect(host.textContent).toContain('Ana Pérez');
  });
});
