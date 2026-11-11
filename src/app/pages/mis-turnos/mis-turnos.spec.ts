import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { MisTurnos } from './mis-turnos';

const TURNOS = [
  {
    id: 1,
    nombreServicio: 'Corte de pelo',
    fechaTurno: '2026-11-10T09:00:00',
    estadoTurno: 'PENDIENTE',
    puntuacion: null,
  },
  {
    id: 2,
    nombreServicio: 'Color completo',
    fechaTurno: '2026-11-14T17:30:00',
    estadoTurno: 'CANCELADO',
    puntuacion: null,
  },
  {
    id: 3,
    nombreServicio: 'Arreglo de barba',
    fechaTurno: '2026-11-12T11:15:00',
    estadoTurno: 'REALIZADO',
    puntuacion: 4,
  },
] as const;

const DETALLE = {
  fechaReserva: '2026-11-05T10:12:00',
  fechaHora: '2026-11-12T23:30:00',
  estadoTurno: 'CONFIRMADO',
  empleado: { nombre: 'Ana', apellido: 'Pérez' },
  servicio: { id: 5, nombre: 'Corte de pelo', precio: '12500.00', duracion: 45 },
  cliente: { nombre: 'Luis', apellido: 'Gómez' },
  resenia: null,
} as const;

const SERVICIO = {
  id: 5,
  nombre: 'Corte de pelo',
  nombreSucursal: 'Sucursal Centro',
  direccionSucursal: 'Av. Siempre Viva 123',
  categoriaSucursal: 'PELUQUERIA',
};

const SUCURSAL = {
  id: 7,
  nombre: 'Sucursal Centro',
  categoria: 'PELUQUERIA',
  fotoPerfil: 'https://example.com/sucursal.jpg',
  puntuacion: 4.5,
  cantidadPuntuaciones: 12,
};

const SERVICIOS_SUCURSAL = [
  { id: 5, nombre: 'Corte de pelo', precio: 12500, duracion: 45 },
  { id: 9, nombre: 'Color', precio: 18000, duracion: 90 },
];

describe('Mis Turnos', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<MisTurnos>>;
  let backend: HttpTestingController;
  let html: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MisTurnos],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(MisTurnos);
    fixture.detectChanges();
    html = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => {
    fixture.destroy();
    backend.verify();
  });

  function flushLista(turnos: readonly unknown[] = TURNOS): void {
    backend.expectOne((request) => request.url.endsWith('/turnos/propios')).flush(turnos);
    fixture.detectChanges();
  }

  function botonesTurno(): HTMLButtonElement[] {
    return Array.from(html.querySelectorAll<HTMLButtonElement>('button.turno'));
  }

  async function abrirDetalle(id = 1): Promise<void> {
    const boton = botonesTurno().find((elemento) =>
      elemento.getAttribute('aria-label')?.includes('Corte de pelo'),
    );
    expect(boton).toBeTruthy();
    boton!.click();
    fixture.detectChanges();

    backend
      .expectOne((request) => request.url.endsWith(`/turnos/propios/detalles/${id}`))
      .flush(DETALLE);
    fixture.detectChanges();

    backend
      .expectOne((request) => request.url.endsWith('/servicios/5'))
      .flush(SERVICIO);
    fixture.detectChanges();

    backend
      .expectOne((request) => request.url.endsWith('/sucursales/listar/filtrar'))
      .flush([SUCURSAL]);
    fixture.detectChanges();

    backend
      .expectOne((request) => request.url.endsWith('/servicios/listar/sucursal/7'))
      .flush(SERVICIOS_SUCURSAL);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it('carga todos los turnos y los ordena del más reciente al más antiguo', () => {
    expect(html.textContent).toContain('Cargando tus turnos');
    flushLista();

    const botones = botonesTurno();
    expect(botones).toHaveLength(3);
    expect(botones[0].textContent).toContain('Color completo');
    expect(botones[1].textContent).toContain('Arreglo de barba');
    expect(botones[2].textContent).toContain('Corte de pelo');

    expect(html.textContent).toContain('Pendiente');
    expect(html.textContent).toContain('Cancelado');
    expect(html.textContent).toContain('Realizado');
    expect(html.querySelector('.panel__contador')?.textContent?.trim()).toBe('3');
  });

  it('filtra por estado y permite volver a ver todos', () => {
    flushLista();
    const select = html.querySelector('select') as HTMLSelectElement;

    select.value = 'CANCELADO';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(botonesTurno()).toHaveLength(1);
    expect(botonesTurno()[0].textContent).toContain('Color completo');

    select.value = 'PAGO_RECHAZADO';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(html.textContent).toContain('No tenés turnos con ese estado');

    const verTodos = Array.from(html.querySelectorAll('button')).find((boton) =>
      boton.textContent?.includes('Ver todos los turnos'),
    ) as HTMLButtonElement;
    verTodos.click();
    fixture.detectChanges();
    expect(botonesTurno()).toHaveLength(3);
  });

  it('muestra el estado vacío cuando el cliente todavía no tiene turnos', () => {
    flushLista([]);
    expect(html.textContent).toContain('Todavía no tenés turnos');
    expect(html.querySelector('a[href="/sucursales"]')).not.toBeNull();
  });

  it('muestra un error inline y permite reintentar la carga', () => {
    backend
      .expectOne((request) => request.url.endsWith('/turnos/propios'))
      .flush(null, { status: 500, statusText: 'Error' });
    fixture.detectChanges();

    const alerta = html.querySelector('[role="alert"]');
    expect(alerta?.textContent).toContain('No pudimos cargar tus turnos');

    const reintentar = Array.from(html.querySelectorAll('button')).find((boton) =>
      boton.textContent?.includes('Reintentar'),
    ) as HTMLButtonElement;
    reintentar.click();
    fixture.detectChanges();
    expect(reintentar.disabled).toBe(true);
    expect(reintentar.getAttribute('aria-busy')).toBe('true');

    flushLista();
    expect(botonesTurno()).toHaveLength(3);
    expect(html.querySelector('[role="alert"]')).toBeNull();
  });

  it('abre el detalle con sucursal, servicio, personas, fechas y estado', async () => {
    flushLista();
    await abrirDetalle();

    const dialogo = html.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialogo).not.toBeNull();
    expect(dialogo.getAttribute('aria-labelledby')).toBe('detalle-turno-titulo');
    expect(dialogo.textContent).toContain('Sucursal Centro');
    expect(dialogo.textContent).toContain('Corte de pelo');
    expect(dialogo.textContent).toContain('12.500');
    expect(dialogo.textContent).toContain('45 min');
    expect(dialogo.textContent).toContain('Ana Pérez');
    expect(dialogo.textContent).toContain('Luis Gómez');
    expect(dialogo.textContent).toContain('05/11/2026');
    expect(dialogo.textContent).toContain('12/11/2026 · 23:30');
    expect(dialogo.textContent).toContain('13/11/2026 · 00:15');
    expect(dialogo.textContent).toContain('4.5 de 5');
    expect(dialogo.textContent).toContain('12 reseñas');
    expect(dialogo.querySelector('a[href="/sucursal/7"]')?.textContent).toContain(
      'Ver sucursal',
    );

    const resenar = Array.from(dialogo.querySelectorAll('button')).find((boton) =>
      boton.textContent?.trim() === 'Reseñar',
    ) as HTMLButtonElement;
    expect(resenar).toBeTruthy();
    expect(resenar.disabled).toBe(true);
  });

  it('muestra el error del detalle y permite reintentarlo', async () => {
    flushLista();
    const boton = botonesTurno()[2];
    boton.click();
    fixture.detectChanges();

    backend
      .expectOne((request) => request.url.endsWith('/turnos/propios/detalles/1'))
      .flush(null, { status: 500, statusText: 'Error' });
    fixture.detectChanges();
    expect(html.querySelector('[role="dialog"]')?.textContent).toContain(
      'No pudimos cargar el detalle',
    );

    const reintentar = Array.from(
      html.querySelectorAll<HTMLButtonElement>('[role="dialog"] button'),
    ).find((elemento) => elemento.textContent?.includes('Reintentar'));
    expect(reintentar).toBeTruthy();
    reintentar!.click();
    fixture.detectChanges();

    backend
      .expectOne((request) => request.url.endsWith('/turnos/propios/detalles/1'))
      .flush(DETALLE);
    fixture.detectChanges();
    backend
      .expectOne((request) => request.url.endsWith('/servicios/5'))
      .flush(SERVICIO);
    fixture.detectChanges();
    backend
      .expectOne((request) => request.url.endsWith('/sucursales/listar/filtrar'))
      .flush([SUCURSAL]);
    fixture.detectChanges();
    backend
      .expectOne((request) => request.url.endsWith('/servicios/listar/sucursal/7'))
      .flush(SERVICIOS_SUCURSAL);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(html.querySelector('[role="dialog"]')?.textContent).toContain('Ana Pérez');
  });

  it('cierra el detalle con el botón visible y con Escape', async () => {
    flushLista();
    await abrirDetalle();

    const cerrar = html.querySelector(
      '.detalle__cerrar',
    ) as HTMLButtonElement;
    expect(cerrar.getAttribute('aria-label')).toBe('Cerrar detalle del turno');
    cerrar.click();
    fixture.detectChanges();
    expect(html.querySelector('[role="dialog"]')).toBeNull();

    await abrirDetalle();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(html.querySelector('[role="dialog"]')).toBeNull();
  });
});
