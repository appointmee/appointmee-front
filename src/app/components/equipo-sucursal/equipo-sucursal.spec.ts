import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { EmpleadoDTO } from '../../models/empleado';
import { EquipoSucursal } from './equipo-sucursal';

const EMPLEADOS: readonly EmpleadoDTO[] = [
  {
    id: 7,
    nombre: 'Ana',
    apellido: 'Pérez',
    urlFotoPerfil: null,
    puntuacion: 4,
    cantidadPuntuaciones: 2,
  },
  {
    id: 8,
    nombre: 'Luis',
    apellido: 'Gómez',
    urlFotoPerfil: null,
    puntuacion: null,
    cantidadPuntuaciones: 0,
  },
];

describe('EquipoSucursal · listado de empleados', () => {
  let fixture: ComponentFixture<EquipoSucursal>;
  let backend: HttpTestingController;
  let html: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EquipoSucursal],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(EquipoSucursal);
    fixture.componentRef.setInput('sucursalId', 5);
    fixture.componentRef.setInput('limite', null);
    fixture.componentRef.setInput('mostrarVerMas', false);
    backend = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    html = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  function pedirEmpleados(): ReturnType<HttpTestingController['expectOne']> {
    return backend.expectOne((request) =>
      request.url.endsWith('/sucursales/5/elegir-empleado'),
    );
  }

  function tarjetas(): HTMLElement[] {
    return Array.from(html.querySelectorAll<HTMLElement>('.equipo-card'));
  }

  it('muestra el estado de carga mientras consulta el equipo', () => {
    expect(html.textContent).toContain('Cargando profesionales');
    expect(html.querySelector('[aria-busy="true"]')).not.toBeNull();

    pedirEmpleados().flush([]);
    fixture.detectChanges();
  });

  it('muestra el listado de empleados de la sucursal', () => {
    pedirEmpleados().flush(EMPLEADOS);
    fixture.detectChanges();

    expect(tarjetas()).toHaveLength(2);
    expect(html.textContent).toContain('Ana');
    expect(html.textContent).toContain('Pérez');
    expect(html.textContent).toContain('Luis');
    expect(html.textContent).toContain('Gómez');
  });

  it('cada empleado enlaza a su detalle con un nombre accesible', () => {
    pedirEmpleados().flush(EMPLEADOS);
    fixture.detectChanges();

    const enlaces = Array.from(
      html.querySelectorAll<HTMLAnchorElement>('.equipo-card__enlace'),
    );

    expect(enlaces).toHaveLength(2);
    expect(enlaces[0].getAttribute('href')).toBe('/sucursal/5/empleado/7');
    expect(enlaces[0].getAttribute('aria-label')).toBe('Ver detalle de Ana Pérez');
    expect(enlaces[1].getAttribute('href')).toBe('/sucursal/5/empleado/8');
    expect(enlaces[1].getAttribute('aria-label')).toBe('Ver detalle de Luis Gómez');
  });

  it('muestra el estado vacío cuando la sucursal no tiene empleados', () => {
    pedirEmpleados().flush([]);
    fixture.detectChanges();

    expect(tarjetas()).toHaveLength(0);
    expect(html.textContent).toContain('Todavía no hay profesionales cargados');
  });

  it('muestra el error inline y permite reintentar', () => {
    pedirEmpleados().flush(null, { status: 500, statusText: 'Error' });
    fixture.detectChanges();

    expect(html.querySelector('[role="alert"]')?.textContent).toContain(
      'No pudimos cargar al equipo de esta sucursal.',
    );

    const reintentar = Array.from(html.querySelectorAll('button')).find((boton) =>
      boton.textContent?.includes('Reintentar'),
    ) as HTMLButtonElement;
    reintentar.click();
    fixture.detectChanges();

    pedirEmpleados().flush(EMPLEADOS);
    fixture.detectChanges();

    expect(tarjetas()).toHaveLength(2);
  });
});
