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

  it('carga las sucursales propias y muestra las 5 tarjetas al gestionar una', () => {
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

    expect(host.textContent).toContain('Servicios');
    expect(host.textContent).toContain('Empleados');
    expect(host.textContent).toContain('Galería de imágenes');
    expect(host.textContent).toContain('Turnos');
    expect(host.textContent).toContain('Solicitudes');
    expect(host.textContent).toContain('Sucursal');
  });
});
