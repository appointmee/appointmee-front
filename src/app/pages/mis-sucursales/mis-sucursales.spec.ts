import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { MisSucursales } from './mis-sucursales';
import { authService } from '../../services/auth-service';

describe('MisSucursales', () => {
  let fixture: ComponentFixture<MisSucursales>;
  let backend: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MisSucursales],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: authService,
          useValue: { perfil: signal({ id: 7, email: 'empleador@ejemplo.com' }) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MisSucursales);
    backend = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  it('carga las sucursales propias y permite gestionar una', () => {
    const req = backend.expectOne((request) =>
      request.url.endsWith('/sucursales/listar/propias'),
    );
    req.flush([{ id: 5, nombre: 'Sucursal Uno', categoria: 'BARBERIA', fotoPerfil: null, puntuacion: 4, cantidadPuntuaciones: 2 }]);

    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('Sucursal Uno');

    const gestionar = Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      b.textContent?.includes('Gestionar'),
    );
    gestionar?.click();
    fixture.detectChanges();

    const empleados = backend.expectOne((request) =>
      request.url.endsWith('/sucursales/5/empleados'),
    );
    empleados.flush([]);

    const enviadas = backend.expectOne((request) =>
      request.url.endsWith('/solicitudes-empleado/enviadas/sucursal/5'),
    );
    enviadas.flush([]);
    fixture.detectChanges();

    expect(host.textContent).toContain('Enviar solicitudes de empleo');
  });

  it('permite agregarse al equipo y confirma el resultado inline', () => {
    backend
      .expectOne((request) => request.url.endsWith('/sucursales/listar/propias'))
      .flush([{ id: 5, nombre: 'Sucursal Uno', categoria: 'BARBERIA', fotoPerfil: null, puntuacion: 4, cantidadPuntuaciones: 2 }]);

    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    Array.from(host.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent?.includes('Gestionar'))
      ?.click();
    fixture.detectChanges();

    backend
      .expectOne((request) => request.url.endsWith('/sucursales/5/empleados'))
      .flush([]);
    backend
      .expectOne((request) => request.url.endsWith('/solicitudes-empleado/enviadas/sucursal/5'))
      .flush([]);
    fixture.detectChanges();

    Array.from(host.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent?.includes('Agregarme como empleado'))
      ?.click();
    const agregarme = backend.expectOne((request) =>
      request.url.endsWith('/sucursales/5/convertirme-empleado'),
    );
    expect(agregarme.request.method).toBe('PATCH');
    agregarme.flush('Ahora sos empleado de la sucursal');
    fixture.detectChanges();

    expect(host.textContent).toContain('Ya formás parte del equipo de esta sucursal.');
    expect(host.textContent).not.toContain('Agregarme como empleado');
  });

  it('oculta la acción si ya forma parte del equipo', () => {
    backend
      .expectOne((request) => request.url.endsWith('/sucursales/listar/propias'))
      .flush([{ id: 5, nombre: 'Sucursal Uno', categoria: 'BARBERIA', fotoPerfil: null, puntuacion: 4, cantidadPuntuaciones: 2 }]);

    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    Array.from(host.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent?.includes('Gestionar'))
      ?.click();
    fixture.detectChanges();

    backend
      .expectOne((request) => request.url.endsWith('/sucursales/5/empleados'))
      .flush([
        {
          id: 7,
          nombre: 'Empleador',
          apellido: 'Ejemplo',
          email: 'empleador@ejemplo.com',
          urlFotoPerfil: null,
        },
      ]);
    backend
      .expectOne((request) => request.url.endsWith('/solicitudes-empleado/enviadas/sucursal/5'))
      .flush([]);
    fixture.detectChanges();

    expect(host.textContent).toContain('Ya formás parte del equipo de esta sucursal.');
    expect(host.textContent).not.toContain('Agregarme como empleado');
  });

  it('muestra el error inline si falla la incorporación', () => {
    backend
      .expectOne((request) => request.url.endsWith('/sucursales/listar/propias'))
      .flush([{ id: 5, nombre: 'Sucursal Uno', categoria: 'BARBERIA', fotoPerfil: null, puntuacion: 4, cantidadPuntuaciones: 2 }]);

    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    Array.from(host.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent?.includes('Gestionar'))
      ?.click();
    fixture.detectChanges();

    backend
      .expectOne((request) => request.url.endsWith('/sucursales/5/empleados'))
      .flush([]);
    backend
      .expectOne((request) => request.url.endsWith('/solicitudes-empleado/enviadas/sucursal/5'))
      .flush([]);
    fixture.detectChanges();

    Array.from(host.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent?.includes('Agregarme como empleado'))
      ?.click();
    backend
      .expectOne((request) => request.url.endsWith('/sucursales/5/convertirme-empleado'))
      .flush('Error interno', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      'No pudimos agregarte como empleado.',
    );
  });
});
