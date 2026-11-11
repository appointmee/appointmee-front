import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';

import { TurnosSucursal } from './turnos-sucursal';

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
  fotoPerfil: 'https://example.com/sucursal.jpg',
  imagenes: [],
};

const DETALLE = {
  id: 1,
  fechaReserva: '2026-11-05T10:12:00',
  fechaTurno: '2026-11-12T23:30:00',
  estadoTurno: 'CONFIRMADO',
  cliente: { nombre: 'Luis', apellido: 'Gómez' },
  empleado: {
    id: 9,
    nombre: 'Ana',
    apellido: 'Pérez',
    email: 'ana@example.com',
    urlFotoPerfil: 'https://example.com/ana.jpg',
  },
  servicio: { id: 5, nombre: 'Corte de pelo', precio: '12500.00', duracion: 45 },
  resenia: null,
} as const;

describe('TurnosSucursal', () => {
  let fixture: ComponentFixture<TurnosSucursal>;
  let backend: HttpTestingController;
  let html: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TurnosSucursal],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: convertToParamMap({ sucursalId: '7' }) },
          },
        },
      ],
    }).compileComponents();

    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(TurnosSucursal);
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
  ): void {
    const request = backend.expectOne(
      (candidate) =>
        candidate.url.endsWith('/turnos/de-sucursal/7') &&
        candidate.params.get('estadoTurno') === estado,
    );
    request.flush(turnos);
    fixture.detectChanges();
  }

  function flushInicial(): void {
    flushSucursal();
    flushLista();
  }

  function botonesTurno(): HTMLButtonElement[] {
    return Array.from(html.querySelectorAll<HTMLButtonElement>('button.turno'));
  }

  function abrirDetalle(detalle: object = DETALLE, id = 1): void {
    const boton = botonesTurno().find((elemento) =>
      elemento.textContent?.includes('Corte de pelo'),
    );
    expect(boton).toBeTruthy();
    boton!.click();
    fixture.detectChanges();

    backend
      .expectOne((request) =>
        request.url.endsWith(`/turnos/de-sucursal/detalles/${id}`),
      )
      .flush(detalle);
    fixture.detectChanges();
  }

  function textoDialogo(): string {
    return html.querySelector('[role="dialog"]')?.textContent ?? '';
  }

  it('carga inicialmente los turnos CONFIRMADO de la sucursal', () => {
    expect(html.textContent).toContain('Cargando los turnos de la sucursal');
    flushInicial();

    expect(botonesTurno()).toHaveLength(2);
    expect(botonesTurno()[0].textContent).toContain('Color completo');
    expect(botonesTurno()[1].textContent).toContain('Corte de pelo');
    expect(html.textContent).toContain('Confirmado');
    expect(html.textContent).toContain('Sucursal Centro');
    expect(html.querySelector('.panel__contador')?.textContent?.trim()).toBe('2');
  });

  it('consulta el estado elegido y evita repetir la misma consulta', () => {
    flushInicial();

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
    expect(html.textContent).toContain('Pendiente');

    select.value = 'PENDIENTE';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    backend.expectNone((request) => request.url.endsWith('/turnos/de-sucursal/7'));
  });

  it('muestra el estado vacío para el estado consultado', () => {
    flushSucursal();
    flushLista([]);

    expect(html.textContent).toContain('No hay turnos en estado Confirmado');
    expect(html.textContent).toContain(
      'Probá seleccionando otro estado para consultar el resto del historial.',
    );
  });

  it('muestra un error inline y permite reintentar con el mismo estado', () => {
    flushSucursal();
    backend
      .expectOne(
        (request) =>
          request.url.endsWith('/turnos/de-sucursal/7') &&
          request.params.get('estadoTurno') === 'CONFIRMADO',
      )
      .flush(null, { status: 500, statusText: 'Error' });
    fixture.detectChanges();

    expect(html.querySelector('[role="alert"]')?.textContent).toContain(
      'No pudimos cargar los turnos',
    );

    const reintentar = Array.from(html.querySelectorAll('button')).find((boton) =>
      boton.textContent?.includes('Reintentar'),
    ) as HTMLButtonElement;
    reintentar.click();
    fixture.detectChanges();
    expect(reintentar.disabled).toBe(true);
    expect(reintentar.getAttribute('aria-busy')).toBe('true');

    flushLista();
    expect(botonesTurno()).toHaveLength(2);
    expect(html.querySelector('[role="alert"]')).toBeNull();
  });

  it('abre el detalle con sucursal, servicio, profesional, cliente, fechas y estado', () => {
    flushInicial();
    abrirDetalle();

    expect(html.querySelector('[role="dialog"]')).not.toBeNull();
    expect(textoDialogo()).toContain('Sucursal Centro');
    expect(textoDialogo()).toContain('Peluqueria');
    expect(textoDialogo()).toContain('Av. Siempre Viva 123');
    expect(textoDialogo()).toContain('Corte de pelo');
    expect(textoDialogo()).toContain('12.500');
    expect(textoDialogo()).toContain('45 min');
    expect(textoDialogo()).toContain('Ana Pérez');
    expect(textoDialogo()).toContain('ana@example.com');
    expect(textoDialogo()).toContain('Luis Gómez');
    expect(textoDialogo()).toContain('4.5 de 5');
    expect(textoDialogo()).toContain('12 reseñas');
    expect(
      html.querySelector('[role="dialog"] a[href="/sucursal/7"]')?.textContent,
    ).toContain('Ver sucursal');
    expect(textoDialogo()).toContain('05/11/2026');
    expect(textoDialogo()).toContain('12/11/2026 · 23:30');
    expect(textoDialogo()).toContain('13/11/2026 · 00:15');
    expect(textoDialogo()).toContain('Confirmado');
    expect(textoDialogo()).toContain('Todavía no se ha publicado una reseña');
    expect(textoDialogo()).not.toContain('Reseñar');
  });

  it('muestra una reseña corta completa y sin botón Ver más', () => {
    flushInicial();
    abrirDetalle({
      ...DETALLE,
      resenia: {
        puntuacion: 5,
        comentario: 'Excelente atención y puntualidad.',
        fechaResenia: '2026-11-13',
      },
    });

    expect(textoDialogo()).toContain('Excelente atención y puntualidad.');
    expect(textoDialogo()).toContain('5 de 5');
    expect(textoDialogo()).toContain('13/11/2026');
    expect(
      Array.from(html.querySelectorAll('[role="dialog"] button')).some(
        (boton) => boton.textContent?.trim() === 'Ver más',
      ),
    ).toBe(false);
  });

  it('permite expandir y contraer una reseña larga', () => {
    flushInicial();
    const comentario = `${'Muy buen servicio. '.repeat(20)}Fin del comentario.`;
    abrirDetalle({
      ...DETALLE,
      resenia: {
        puntuacion: 4,
        comentario,
        fechaResenia: '2026-11-13',
      },
    });

    const toggle = () => {
      return Array.from(
        html.querySelectorAll<HTMLButtonElement>('[role="dialog"] button'),
      ).find((boton) => boton.textContent?.includes('Ver'));
    };

    expect(toggle()?.textContent?.trim()).toBe('Ver más');
    expect(toggle()?.getAttribute('aria-expanded')).toBe('false');
    expect(textoDialogo()).toContain('…');
    expect(textoDialogo()).not.toContain(comentario);

    toggle()!.click();
    fixture.detectChanges();
    expect(toggle()?.textContent?.trim()).toBe('Ver menos');
    expect(toggle()?.getAttribute('aria-expanded')).toBe('true');
    expect(textoDialogo()).toContain(comentario);

    toggle()!.click();
    fixture.detectChanges();
    expect(toggle()?.textContent?.trim()).toBe('Ver más');
    expect(textoDialogo()).not.toContain(comentario);
  });

  it('muestra un fallback cuando el profesional no tiene fotografía', () => {
    flushInicial();
    abrirDetalle({
      ...DETALLE,
      empleado: { ...DETALLE.empleado, urlFotoPerfil: null },
    });

    const foto = html.querySelector('.persona__foto');
    expect(foto?.querySelector('img')).toBeNull();
    expect(foto?.textContent).toContain('AP');
  });

  it('muestra las iniciales cuando la fotografía del profesional falla', () => {
    flushInicial();
    abrirDetalle();

    const foto = html.querySelector('.persona__foto') as HTMLElement;
    const imagen = foto.querySelector('img') as HTMLImageElement;
    imagen.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    expect(foto.querySelector('img')).toBeNull();
    expect(foto.textContent).toContain('AP');
  });

  it('muestra el error de la sucursal y permite reintentarlo dentro del modal', () => {
    backend
      .expectOne((request) => request.url.endsWith('/sucursales/7'))
      .flush(null, { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();
    flushLista();
    abrirDetalle();

    expect(textoDialogo()).toContain(
      'No pudimos cargar los datos de la sucursal',
    );

    const reintentar = Array.from(
      html.querySelectorAll<HTMLButtonElement>('[role="dialog"] button'),
    ).find((elemento) => elemento.textContent?.includes('Reintentar'));
    expect(reintentar).toBeTruthy();
    reintentar!.click();
    fixture.detectChanges();

    backend
      .expectOne((request) => request.url.endsWith('/sucursales/7'))
      .flush(SUCURSAL);
    fixture.detectChanges();

    expect(textoDialogo()).toContain('Sucursal Centro');
    expect(textoDialogo()).toContain('Av. Siempre Viva 123');
  });

  it('muestra el error del detalle y permite reintentarlo', () => {
    flushInicial();

    const boton = botonesTurno().find((elemento) =>
      elemento.textContent?.includes('Corte de pelo'),
    );
    boton!.click();
    fixture.detectChanges();

    backend
      .expectOne((request) =>
        request.url.endsWith('/turnos/de-sucursal/detalles/1'),
      )
      .flush(null, { status: 500, statusText: 'Error' });
    fixture.detectChanges();
    expect(textoDialogo()).toContain('No pudimos cargar el detalle');

    const reintentar = Array.from(
      html.querySelectorAll<HTMLButtonElement>('[role="dialog"] button'),
    ).find((elemento) => elemento.textContent?.includes('Reintentar'));
    expect(reintentar).toBeTruthy();
    reintentar!.click();
    fixture.detectChanges();

    backend
      .expectOne((request) =>
        request.url.endsWith('/turnos/de-sucursal/detalles/1'),
      )
      .flush(DETALLE);
    fixture.detectChanges();

    expect(textoDialogo()).toContain('Ana Pérez');
  });

  it('cierra el detalle con el botón, con Escape y con clic fuera', () => {
    flushInicial();
    abrirDetalle();

    const cerrar = html.querySelector(
      '[role="dialog"] .detalle__cerrar',
    ) as HTMLButtonElement;
    expect(cerrar.getAttribute('aria-label')).toBe('Cerrar detalle del turno');
    cerrar.click();
    fixture.detectChanges();
    expect(html.querySelector('[role="dialog"]')).toBeNull();

    abrirDetalle();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(html.querySelector('[role="dialog"]')).toBeNull();

    abrirDetalle();
    const backdrop = html.querySelector('.ds-modal-backdrop') as HTMLElement;
    backdrop.click();
    fixture.detectChanges();
    expect(html.querySelector('[role="dialog"]')).toBeNull();
  });
});
