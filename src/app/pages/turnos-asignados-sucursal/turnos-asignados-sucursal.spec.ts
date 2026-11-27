import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';

import { TurnosAsignadosSucursal } from './turnos-asignados-sucursal';

const TURNOS = [
  {
    id: 1,
    nombreServicio: 'Corte de pelo',
    fechaTurno: '2026-11-10T09:00:00',
    estadoTurno: 'CONFIRMADO',
    puntuacion: null,
  },
  {
    id: 2,
    nombreServicio: 'Color completo',
    fechaTurno: '2026-11-14T17:30:00',
    estadoTurno: 'CONFIRMADO',
    puntuacion: null,
  },
] as const;

const SUCURSAL = {
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

function paginaTurnos(
  contenido: readonly unknown[],
  opciones: {
    readonly totalElements?: number;
    readonly totalPages?: number;
    readonly number?: number;
  } = {},
) {
  return {
    content: [...contenido],
    totalElements: opciones.totalElements ?? contenido.length,
    totalPages: opciones.totalPages ?? 1,
    number: opciones.number ?? 0,
    size: 10,
  };
}

describe('TurnosAsignadosSucursal', () => {
  let fixture: ComponentFixture<TurnosAsignadosSucursal>;
  let backend: HttpTestingController;
  let html: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TurnosAsignadosSucursal],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ sucursalId: '7' }),
              queryParamMap: convertToParamMap({}),
            },
          },
        },
      ],
    }).compileComponents();

    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(TurnosAsignadosSucursal);
    fixture.detectChanges();
    html = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => {
    fixture.destroy();
    backend.verify();
  });

  function flushSucursal(): void {
    backend
      .expectOne((request) => request.url.endsWith('/sucursales/7'))
      .flush(SUCURSAL);
    fixture.detectChanges();
  }

  function flushLista(
    turnos: readonly unknown[] = TURNOS,
    estado = 'CONFIRMADO',
    opciones: {
      readonly totalElements?: number;
      readonly totalPages?: number;
      readonly number?: number;
    } = {},
  ): void {
    const pagina = opciones.number ?? 0;
    const request = backend.expectOne(
      (candidate) =>
        candidate.url.endsWith('/turnos/de-sucursal/7/propios/paginado') &&
        candidate.params.get('estadoTurno') === estado &&
        candidate.params.get('page') === String(pagina),
    );
    expect(request.request.method).toBe('GET');
    request.flush(paginaTurnos(turnos, { ...opciones, number: pagina }));
    fixture.detectChanges();
  }

  function botonesTurno(): HTMLButtonElement[] {
    return Array.from(html.querySelectorAll<HTMLButtonElement>('button.turno'));
  }

  function flushInicial(
    opciones: {
      readonly totalElements?: number;
      readonly totalPages?: number;
    } = {},
  ): void {
    flushSucursal();
    flushLista(TURNOS, 'CONFIRMADO', opciones);
  }

  it('carga la primera página de turnos asignados con page=0', () => {
    expect(html.textContent).toContain('Cargando tus turnos asignados');
    flushInicial();

    expect(botonesTurno()).toHaveLength(2);
    expect(botonesTurno()[0].textContent).toContain('Color completo');
    expect(botonesTurno()[1].textContent).toContain('Corte de pelo');
    expect(html.textContent).toContain('Sucursal Centro');
    expect(html.querySelector('.panel__contador')?.textContent?.trim()).toBe('2');
    expect(html.querySelector('ds-pagination')).toBeNull();
  });

  it('navega a la página 2 con page=1', () => {
    flushInicial({ totalElements: 14, totalPages: 2 });

    const paginacion = html.querySelector('ds-pagination');
    expect(paginacion).not.toBeNull();
    (paginacion?.querySelector('.ds-pagination__next') as HTMLButtonElement).click();
    fixture.detectChanges();

    const segundaPagina = [
      {
        id: 10,
        nombreServicio: 'Pedicura',
        fechaTurno: '2026-11-18T16:00:00',
        estadoTurno: 'CONFIRMADO',
        puntuacion: null,
      },
    ];
    flushLista(segundaPagina, 'CONFIRMADO', {
      totalElements: 14,
      totalPages: 2,
      number: 1,
    });

    expect(botonesTurno()).toHaveLength(1);
    expect(botonesTurno()[0].textContent).toContain('Pedicura');
    expect(html.querySelector('.panel__contador')?.textContent?.trim()).toBe('14');
    expect(paginacion?.textContent).toContain('Página 2 de 2');
  });

  it('reinicia la página a 0 al cambiar el estado', () => {
    flushInicial({ totalElements: 14, totalPages: 2 });
    (html.querySelector('.ds-pagination__next') as HTMLButtonElement).click();
    fixture.detectChanges();
    flushLista([TURNOS[0]], 'CONFIRMADO', {
      totalElements: 14,
      totalPages: 2,
      number: 1,
    });

    const select = html.querySelector('select') as HTMLSelectElement;
    select.value = 'PENDIENTE';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    flushLista(
      [
        {
          id: 9,
          nombreServicio: 'Manicura',
          fechaTurno: '2026-11-20T10:00:00',
          estadoTurno: 'PENDIENTE',
          puntuacion: null,
        },
      ],
      'PENDIENTE',
    );

    expect(botonesTurno()).toHaveLength(1);
    expect(botonesTurno()[0].textContent).toContain('Manicura');
    expect(html.querySelector('ds-pagination')).toBeNull();
  });
});
