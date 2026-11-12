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

  it('muestra tarjetas skeleton cuadradas mientras carga las sucursales', () => {
    const host = fixture.nativeElement as HTMLElement;
    const lista = host.querySelector<HTMLElement>('.lista--cargando');

    expect(lista?.getAttribute('aria-busy')).toBe('true');
    expect(lista?.getAttribute('aria-live')).toBe('polite');
    expect(lista?.querySelector('.sr-only')?.textContent).toContain('Cargando tus sucursales');
    expect(lista?.querySelectorAll('.sucursal-card--skeleton')).toHaveLength(3);
    expect(lista?.querySelectorAll('.skeleton--avatar')).toHaveLength(3);
    expect(lista?.querySelectorAll('.skeleton--line')).toHaveLength(6);
    expect(lista?.querySelectorAll('button, a')).toHaveLength(0);

    backend.expectOne((request) => request.url.endsWith('/sucursales/listar/propias')).flush([]);
  });

  it('carga las sucursales propias y muestra las 5 tarjetas al gestionar una', () => {
    const req = backend.expectOne((request) =>
      request.url.endsWith('/sucursales/listar/propias'),
    );
    req.flush([{ id: 5, nombre: 'Sucursal Uno', categoria: 'BARBERIA', fotoPerfil: null, puntuacion: 4, cantidadPuntuaciones: 2 }]);

    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('Sucursal Uno');

    const gestionar = host.querySelector<HTMLButtonElement>('.sucursal-card__accion');
    gestionar?.click();
    fixture.detectChanges();

    expect(host.textContent).toContain('Servicios');
    expect(host.textContent).toContain('Empleados');
    expect(host.textContent).toContain('Galería de imágenes');
    expect(host.textContent).toContain('Turnos');
    expect(host.textContent).toContain('Solicitudes');
    expect(host.textContent).toContain('Sucursal');
    expect(host.querySelector('.gestor')?.previousElementSibling?.classList.contains('volver-gestor')).toBe(true);
  });
});
