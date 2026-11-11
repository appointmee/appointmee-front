import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, ParamMap, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';

import { SucursalDetalleDTO } from '../../models/sucursal';
import { EmpleadoDetalle } from './empleado-detalle';

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
    urlFotoPerfil: 'https://example.com/ana.jpg',
    puntuacion: 4,
    cantidadPuntuaciones: 3,
  },
  {
    id: 10,
    nombre: 'Luis',
    apellido: 'Gómez',
    urlFotoPerfil: null,
    puntuacion: null,
    cantidadPuntuaciones: 0,
  },
];

describe('EmpleadoDetalle', () => {
  let fixture: ComponentFixture<EmpleadoDetalle>;
  let backend: HttpTestingController;
  let html: HTMLElement;
  let parametros: BehaviorSubject<ParamMap>;

  beforeEach(async () => {
    parametros = new BehaviorSubject<ParamMap>(
      convertToParamMap({ sucursalId: '7', empleadoId: '9' }),
    );

    await TestBed.configureTestingModule({
      imports: [EmpleadoDetalle],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: parametros.value,
              queryParamMap: convertToParamMap({}),
            },
            paramMap: parametros.asObservable(),
            queryParamMap: of(convertToParamMap({})),
          },
        },
      ],
    }).compileComponents();

    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(EmpleadoDetalle);
    fixture.detectChanges();
    html = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  function flushSucursal(): void {
    backend
      .expectOne((request) => request.url.endsWith('/sucursales/7'))
      .flush(SUCURSAL);
    fixture.detectChanges();
  }

  function flushEmpleados(empleados: readonly unknown[] = EMPLEADOS): void {
    backend
      .expectOne((request) => request.url.endsWith('/sucursales/7/elegir-empleado'))
      .flush(empleados);
    fixture.detectChanges();
  }

  it('muestra el estado de carga antes de resolver los datos', () => {
    expect(html.textContent).toContain('Cargando el detalle del profesional');
    expect(html.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(html.querySelector('[role="status"]')).not.toBeNull();

    flushSucursal();
    flushEmpleados();
  });

  it('muestra el detalle del empleado con su sucursal y acciones', () => {
    flushSucursal();
    flushEmpleados();

    expect(html.querySelector('h1')?.textContent).toContain('Ana Pérez');
    expect(html.textContent).toContain('Sucursal Centro');
    expect(html.textContent).toContain('4 de 5');
    expect(html.textContent).toContain('3 reseñas');

    const img = html.querySelector<HTMLImageElement>('.perfil__avatar');
    expect(img?.getAttribute('src')).toBe('https://example.com/ana.jpg');
    expect(img?.getAttribute('alt')).toBe('Fotografía de Ana Pérez');

    const enlaces = Array.from(html.querySelectorAll<HTMLAnchorElement>('a'));
    expect(enlaces.some((a) => a.getAttribute('href') === '/sucursal/7/servicios')).toBe(true);
    expect(enlaces.some((a) => a.getAttribute('href') === '/sucursal/7/equipo')).toBe(true);
    expect(TestBed.inject(Title).getTitle()).toBe('AppointMee | Ana Pérez');
  });

  it('informa cuando el empleado ya no forma parte del equipo', () => {
    flushSucursal();
    flushEmpleados([EMPLEADOS[1]]);

    expect(html.textContent).toContain('No encontramos a este profesional');
    expect(html.textContent).toContain('Sucursal Centro');
    expect(
      html.querySelector<HTMLAnchorElement>('a[href="/sucursal/7/equipo"]'),
    ).not.toBeNull();
  });

  it('muestra la sucursal no encontrada', () => {
    backend
      .expectOne((request) => request.url.endsWith('/sucursales/7'))
      .flush(null, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();

    expect(html.textContent).toContain('No encontramos esta sucursal');
  });

  it('muestra un error inline y permite reintentar el detalle', () => {
    flushSucursal();
    backend
      .expectOne((request) => request.url.endsWith('/sucursales/7/elegir-empleado'))
      .flush(null, { status: 500, statusText: 'Error' });
    fixture.detectChanges();

    expect(html.querySelector('[role="alert"]')?.textContent).toContain(
      'No pudimos cargar la información del profesional.',
    );

    const reintentar = Array.from(html.querySelectorAll('button')).find((boton) =>
      boton.textContent?.includes('Reintentar'),
    ) as HTMLButtonElement;
    reintentar.click();
    fixture.detectChanges();

    flushSucursal();
    flushEmpleados();

    expect(html.querySelector('h1')?.textContent).toContain('Ana Pérez');
  });

  it('no consulta la API si los identificadores de la ruta son inválidos', () => {
    flushSucursal();
    flushEmpleados();

    parametros.next(convertToParamMap({ sucursalId: 'abc', empleadoId: '9' }));
    fixture.detectChanges();

    backend.expectNone((request) => request.url.includes('/sucursales/'));
    expect(html.textContent).toContain('No encontramos esta sucursal');
  });

  it('usa el avatar de respaldo si la imagen del empleado falla', () => {
    flushSucursal();
    flushEmpleados();

    const img = html.querySelector<HTMLImageElement>('.perfil__avatar')!;
    img.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    expect(img.getAttribute('src')).toContain('data:image/svg+xml');
  });
});
