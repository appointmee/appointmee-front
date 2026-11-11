import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { WritableSignal, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { SucursalDetalleDTO } from '../../models/sucursal';
import { authService } from '../../services/auth-service';
import { SucursalEquipo } from './sucursal-equipo';

const SUCURSAL: SucursalDetalleDTO = {
  id: 7,
  nombre: 'Sucursal Centro',
  direccion: 'Av. Siempre Viva 123',
  telefono: '11 5555-5555',
  descripcion: null,
  fechaCreacion: '2025-01-01',
  categoria: 'PELUQUERIA',
  horaApertura: '09:00',
  horaCierre: '18:00',
  diasApertura: ['LUNES'],
  puntuacion: 4.5,
  cantidadPuntuaciones: 12,
  fotoPerfil: null,
  imagenes: [],
};

const EMPLEADOS = [
  {
    id: 9,
    nombre: 'Ana',
    apellido: 'Pérez',
    urlFotoPerfil: null,
    puntuacion: null,
    cantidadPuntuaciones: 0,
  },
];

const PROPIAS = [
  {
    id: 7,
    nombre: 'Sucursal Centro',
    categoria: 'PELUQUERIA',
    fotoPerfil: null,
    puntuacion: null,
    cantidadPuntuaciones: 0,
  },
];

describe('SucursalEquipo · permisos de eliminación', () => {
  let fixture: ComponentFixture<SucursalEquipo> | null = null;
  let backend: HttpTestingController;
  let html: HTMLElement;
  let perfil: WritableSignal<{
    id: number;
    roles: readonly string[];
    fotoPerfil: null;
    email: string;
  } | null>;

  beforeEach(async () => {
    perfil = signal(null);

    await TestBed.configureTestingModule({
      imports: [SucursalEquipo],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: convertToParamMap({ id: '7' }) },
            paramMap: of(convertToParamMap({ id: '7' })),
          },
        },
        { provide: authService, useValue: { perfil } },
      ],
    }).compileComponents();

    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    fixture?.destroy();
    fixture = null;
    backend.verify();
  });

  async function abrir(roles: readonly string[]): Promise<void> {
    perfil.set({
      id: 1,
      roles: [...roles],
      fotoPerfil: null,
      email: 'empleador@ejemplo.com',
    });

    fixture = TestBed.createComponent(SucursalEquipo);
    html = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();

    backend
      .expectOne((request) => request.url.endsWith('/sucursales/7'))
      .flush(SUCURSAL);
    fixture.detectChanges();

    backend
      .expectOne((request) => request.url.endsWith('/sucursales/7/elegir-empleado'))
      .flush(EMPLEADOS);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function resolverPropias(propias: readonly unknown[]): void {
    backend
      .expectOne((request) => request.url.endsWith('/sucursales/listar/propias'))
      .flush(propias);
    fixture!.detectChanges();
  }

  function tieneBotonEliminar(): boolean {
    return html.querySelector('.equipo-card__eliminar') !== null;
  }

  it('permite eliminar al empleador dueño de la sucursal', async () => {
    await abrir(['EMPLEADOR']);
    resolverPropias(PROPIAS);

    expect(tieneBotonEliminar()).toBe(true);
  });

  it('oculta la acción si el empleador no es dueño de la sucursal', async () => {
    await abrir(['EMPLEADOR']);
    resolverPropias([{ ...PROPIAS[0], id: 3, nombre: 'Otra sucursal' }]);

    expect(tieneBotonEliminar()).toBe(false);
  });

  it('oculta la acción si falla la consulta de sucursales propias sin romper la pantalla', async () => {
    await abrir(['EMPLEADOR']);

    backend
      .expectOne((request) => request.url.endsWith('/sucursales/listar/propias'))
      .flush(null, { status: 500, statusText: 'Error' });
    fixture!.detectChanges();

    expect(tieneBotonEliminar()).toBe(false);
    expect(html.textContent).toContain('Todo el equipo');
  });

  it('oculta la acción para usuarios que no son empleadores sin consultar sus sucursales', async () => {
    await abrir(['CLIENTE']);

    backend.expectNone((request) => request.url.endsWith('/sucursales/listar/propias'));
    expect(tieneBotonEliminar()).toBe(false);
  });
});
