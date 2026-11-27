import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';

import { apiErrorsService } from '../../http/api-errors-service';
import { PaginaReseniasDTO, ReseniaDTO, VistaPreviaReseniasDTO } from '../../models/resenia';
import { reseniaService } from '../../services/resenia-service';
import { ReseniasSucursal } from './resenias-sucursal';

/** Orden deliberadamente inverso para detectar ordenamientos locales. */
const CONTENIDO_BACKEND: readonly ReseniaDTO[] = [
  { puntuacion: 5, comentario: 'Primera según backend', fechaResenia: '2024-01-01' },
  { puntuacion: 3, comentario: 'Segunda según backend', fechaResenia: '2026-01-01' },
];

const VISTA_PREVIA: VistaPreviaReseniasDTO = {
  content: CONTENIDO_BACKEND,
  totalElements: 7,
  hayMas: true,
};

function paginaDe(page: number, comentario: string): PaginaReseniasDTO {
  return {
    content: [{ puntuacion: 4, comentario, fechaResenia: '2026-02-01' }],
    totalElements: 23,
    totalPages: 3,
    number: page,
    size: 10,
  };
}

describe('ReseniasSucursal', () => {
  let listarPorSucursal: ReturnType<
    typeof vi.fn<(id: number) => Observable<VistaPreviaReseniasDTO>>
  >;
  let listarPaginadoPorSucursal: ReturnType<
    typeof vi.fn<(id: number, page: number) => Observable<PaginaReseniasDTO>>
  >;

  beforeEach(async () => {
    listarPorSucursal = vi.fn<
      (id: number) => Observable<VistaPreviaReseniasDTO>
    >(() => of(VISTA_PREVIA));
    listarPaginadoPorSucursal = vi.fn<
      (id: number, page: number) => Observable<PaginaReseniasDTO>
    >((_id, page) => of(paginaDe(page, `Página ${page + 1}`)));

    await TestBed.configureTestingModule({
      imports: [ReseniasSucursal],
      providers: [
        provideRouter([]),
        { provide: reseniaService, useValue: { listarPorSucursal, listarPaginadoPorSucursal } },
        { provide: apiErrorsService, useValue: { dismiss: vi.fn() } },
      ],
    }).compileComponents();
  });

  function crear(opciones: { paginaCompleta?: boolean; cantidad?: number | null } = {}) {
    const fixture = TestBed.createComponent(ReseniasSucursal);
    fixture.componentRef.setInput('sucursalId', 7);
    fixture.componentRef.setInput('cantidad', opciones.cantidad ?? null);
    fixture.componentRef.setInput('paginaCompleta', opciones.paginaCompleta ?? false);
    fixture.detectChanges();
    fixture.detectChanges();
    return fixture;
  }

  function comentarios(fixture: ReturnType<typeof crear>): string[] {
    return Array.from(
      fixture.nativeElement.querySelectorAll('.resenia-card__comentario') as NodeListOf<HTMLElement>,
    ).map((elemento) => elemento.textContent?.trim() ?? '');
  }

  it('en vista previa usa el contenido y hayMas del backend sin recortar ni ordenar', () => {
    const fixture = crear({ cantidad: 99 });

    expect(listarPorSucursal).toHaveBeenCalledOnce();
    expect(listarPorSucursal).toHaveBeenCalledWith(7);
    expect(listarPaginadoPorSucursal).not.toHaveBeenCalled();
    expect(comentarios(fixture)).toEqual([
      'Primera según backend',
      'Segunda según backend',
    ]);
    expect(fixture.nativeElement.textContent).toContain('7 reseñas');
    expect(fixture.nativeElement.querySelector('.resenias__ver-mas')?.textContent).toContain(
      'Ver todas las reseñas',
    );
    expect(fixture.nativeElement.querySelector('ds-pagination')).toBeNull();
  });

  it('oculta «Ver más» cuando el backend indica que no hay más reseñas', () => {
    listarPorSucursal.mockReturnValue(
      of({ content: CONTENIDO_BACKEND, totalElements: 2, hayMas: false }),
    );
    const fixture = crear();

    expect(fixture.nativeElement.querySelector('.resenias__ver-mas')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('2 reseñas');
  });

  it('en modo historial pide la página 0 y luego sólo la página 1 con metadata de 10', async () => {
    const fixture = crear({ paginaCompleta: true, cantidad: 99 });

    expect(listarPaginadoPorSucursal).toHaveBeenCalledOnce();
    expect(listarPaginadoPorSucursal).toHaveBeenCalledWith(7, 0);
    expect(listarPorSucursal).not.toHaveBeenCalled();
    expect(comentarios(fixture)).toEqual(['Página 1']);
    expect(fixture.nativeElement.textContent).toContain('23 reseñas · Página 1 de 3');
    expect(fixture.nativeElement.querySelector('.resenias__ver-mas')).toBeNull();

    const paginacion = fixture.nativeElement.querySelector('ds-pagination') as HTMLElement;
    expect(paginacion.querySelector('nav')?.getAttribute('aria-label')).toBe(
      'Paginación de reseñas',
    );
    expect(paginacion.textContent).toContain('Página 1 de 3');

    (paginacion.querySelector('.ds-pagination__next') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(listarPaginadoPorSucursal).toHaveBeenCalledTimes(2);
    expect(listarPaginadoPorSucursal).toHaveBeenNthCalledWith(1, 7, 0);
    expect(listarPaginadoPorSucursal).toHaveBeenNthCalledWith(2, 7, 1);
    expect(comentarios(fixture)).toEqual(['Página 2']);
    expect(fixture.nativeElement.textContent).toContain('Página 2 de 3');
    expect(fixture.nativeElement.querySelector('.resenias__ver-mas')).toBeNull();
  });

  it('mantiene el error inline y reintenta la misma consulta', () => {
    listarPorSucursal
      .mockReturnValueOnce(
        throwError(() => new HttpErrorResponse({ status: 0, statusText: 'Offline' })),
      )
      .mockReturnValueOnce(of(VISTA_PREVIA));
    const fixture = crear();

    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(
      'No pudimos conectarnos',
    );
    const reintentar = fixture.nativeElement.querySelector(
      '.resenias__reintentar',
    ) as HTMLButtonElement;
    reintentar.click();
    fixture.detectChanges();

    expect(listarPorSucursal).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
    expect(comentarios(fixture)).toHaveLength(2);
  });
});

/**
 * Contrato real de GET /sucursales/:id/resenias. El mock del servicio podía
 * ocultar una regresión donde el backend devolvía un array plano y el
 * componente interpretaba `content` como undefined.
 */
describe('ReseniasSucursal con la respuesta HTTP del backend', () => {
  let backend: HttpTestingController;
  let fixture: ComponentFixture<ReseniasSucursal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReseniasSucursal],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: apiErrorsService, useValue: { dismiss: vi.fn() } },
      ],
    }).compileComponents();

    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ReseniasSucursal);
    fixture.componentRef.setInput('sucursalId', 7);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    backend.verify();
  });

  function responder(contenido: readonly ReseniaDTO[], totalElements: number, hayMas: boolean) {
    const peticion = backend.expectOne((request) =>
      request.url.endsWith('/sucursales/7/resenias'),
    );
    expect(peticion.request.method).toBe('GET');
    peticion.flush({ content: contenido, totalElements, hayMas });
    fixture.detectChanges();
  }

  it('muestra cinco reseñas y «Ver más» con el objeto VistaPreviaDTO real', () => {
    const contenido: readonly ReseniaDTO[] = Array.from({ length: 5 }, (_, indice) => ({
      puntuacion: 5,
      comentario: `Reseña ${indice + 1}`,
      fechaResenia: '2026-01-01',
    }));

    responder(contenido, 8, true);

    const comentarios = Array.from(
      fixture.nativeElement.querySelectorAll('.resenia-card__comentario') as NodeListOf<HTMLElement>,
    ).map((elemento) => elemento.textContent?.trim() ?? '');
    expect(comentarios).toEqual(['Reseña 1', 'Reseña 2', 'Reseña 3', 'Reseña 4', 'Reseña 5']);
    expect(fixture.nativeElement.textContent).toContain('8 reseñas');
    expect(fixture.nativeElement.querySelector('.resenias__ver-mas')).toBeTruthy();
  });

  it('oculta «Ver más» cuando el backend informa exactamente cinco reseñas', () => {
    const contenido: readonly ReseniaDTO[] = Array.from({ length: 5 }, (_, indice) => ({
      puntuacion: 4,
      comentario: `Única ${indice + 1}`,
      fechaResenia: '2026-01-01',
    }));

    responder(contenido, 5, false);

    expect(fixture.nativeElement.querySelectorAll('.resenia-card')).toHaveLength(5);
    expect(fixture.nativeElement.querySelector('.resenias__ver-mas')).toBeNull();
  });
});
