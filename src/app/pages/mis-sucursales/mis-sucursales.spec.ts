import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { MisSucursales } from './mis-sucursales';

describe('MisSucursales', () => {
  let fixture: ComponentFixture<MisSucursales>;
  let backend: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MisSucursales],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
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

    const enviadas = backend.expectOne((request) =>
      request.url.endsWith('/solicitudes-empleado/enviadas/sucursal/5'),
    );
    enviadas.flush([]);
    fixture.detectChanges();

    expect(host.textContent).toContain('Enviar solicitudes de empleo');

    const verTurnos = Array.from(host.querySelectorAll<HTMLAnchorElement>('a')).find(
      (enlace) => enlace.textContent?.includes('Ver turnos'),
    );
    expect(verTurnos?.getAttribute('href')).toBe('/mis-sucursales/5/turnos');
  });
});
