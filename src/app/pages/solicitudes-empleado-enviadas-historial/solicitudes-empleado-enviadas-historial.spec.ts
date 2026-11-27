import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { of } from 'rxjs';

import { TAMANO_PAGINA } from '../../models/paginacion';
import {
  SolicitudEmpleadoMiniSucursalDTO,
} from '../../models/solicitud-empleado';
import { SolicitudesEmpleadoEnviadasHistorial } from './solicitudes-empleado-enviadas-historial';

type Invitacion = SolicitudEmpleadoMiniSucursalDTO;

function invitacion(id: number, nombre: string): Invitacion {
  return {
    id,
    nombreEmpleado: nombre,
    apellidoEmpleado: 'Apellido',
    fechaSolicitud: '2026-11-20',
  };
}

function pagina(
  content: readonly Invitacion[],
  totalElements: number,
  totalPages: number,
  number: number,
) {
  return { content, totalElements, totalPages, number, size: TAMANO_PAGINA };
}

describe('Historial de invitaciones enviadas por sucursal', () => {
  let fixture: ComponentFixture<SolicitudesEmpleadoEnviadasHistorial>;
  let backend: HttpTestingController;
  let host: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SolicitudesEmpleadoEnviadasHistorial],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ sucursalId: '7' })) },
        },
      ],
    }).compileComponents();

    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(SolicitudesEmpleadoEnviadasHistorial);
    host = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    backend.verify();
  });

  function listar(page = 0): ReturnType<HttpTestingController['expectOne']> {
    const peticion = backend.expectOne((request) =>
      request.url.endsWith('/solicitudes-empleado/enviadas/sucursal/7/paginado'),
    );
    expect(peticion.request.params.get('page')).toBe(String(page));
    return peticion;
  }

  it('recorre más de diez invitaciones en páginas consecutivas sin duplicados', () => {
    const primera = Array.from({ length: 10 }, (_, indice) =>
      invitacion(100 + indice, `Primera ${indice}`),
    );
    const segunda = [
      invitacion(110, 'Segunda 110'),
      invitacion(111, 'Segunda 111'),
    ];

    listar(0).flush(pagina(primera, 12, 2, 0));
    fixture.detectChanges();

    expect(host.querySelectorAll('app-solicitud-empleado-card')).toHaveLength(10);
    expect(host.textContent).toContain('Página 1 de 2');
    expect(host.textContent).toContain('12 invitaciones en total');
    expect(host.textContent).toContain('Primera 0');

    host.querySelector<HTMLButtonElement>('ds-pagination .ds-pagination__next')?.click();
    fixture.detectChanges();

    listar(1).flush(pagina(segunda, 12, 2, 1));
    fixture.detectChanges();

    expect(host.querySelectorAll('app-solicitud-empleado-card')).toHaveLength(2);
    expect(host.textContent).toContain('Página 2 de 2');
    expect(host.textContent).toContain('Segunda 110');
    expect(host.textContent).toContain('Segunda 111');
    expect(host.textContent).not.toContain('Primera 0');

    host.querySelector<HTMLButtonElement>('ds-pagination .ds-pagination__prev')?.click();
    fixture.detectChanges();

    listar(0).flush(pagina(primera, 12, 2, 0));
    fixture.detectChanges();

    expect(host.querySelectorAll('app-solicitud-empleado-card')).toHaveLength(10);
    expect(host.textContent).toContain('Página 1 de 2');
  });

  it('conserva el contador total cuando llega a una página parcial', () => {
    listar(0).flush(pagina([invitacion(1, 'Única')], 1, 1, 0));
    fixture.detectChanges();

    expect(host.textContent).toContain('Página 1 de 1');
    expect(host.textContent).toContain('1 invitaciones en total');
    expect(host.querySelector('ds-pagination')).toBeNull();
  });
});
