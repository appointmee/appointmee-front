import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { By } from '@angular/platform-browser';
import { Router, RouterOutlet, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { ElegirTurno } from './elegir-turno';
import { PagoTurno } from '../pago-turno/pago-turno';
import { LoginPage } from '../login/login';
import { authService } from '../../services/auth-service';

@Component({
  standalone: true,
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
class TestShell {}

@Component({
  standalone: true,
  template: '',
})
class Dummy {}

const SUCURSAL = {
  id: 7,
  nombre: 'Barber House',
  direccion: 'Av. Siempre Viva 742',
  telefono: null,
  descripcion: null,
  fechaCreacion: null,
  categoria: null,
  horaApertura: null,
  horaCierre: null,
  diasApertura: null,
  puntuacion: 4,
  cantidadPuntuaciones: 20,
  fotoPerfil: null,
};

const SERVICIOS = [
  {
    id: 3,
    nombre: 'Corte de pelo',
    descripcion: 'Corte clásico con lavado',
    duracion: 30,
    precio: 12500,
    fotoPerfil: null,
    puntuacion: 4,
    cantidadPuntuaciones: 8,
    nombreSucursal: 'Barber House',
  },
];

const EMPLEADOS = [
  {
    id: 9,
    nombre: 'Ana',
    apellido: 'Pérez',
    urlFotoPerfil: null,
    puntuacion: 5,
    cantidadPuntuaciones: 10,
  },
  {
    id: 10,
    nombre: 'Bruno',
    apellido: 'Díaz',
    urlFotoPerfil: null,
    puntuacion: null,
    cantidadPuntuaciones: 0,
  },
];

const DIAS = [
  { fecha: '2030-12-20', horarios: ['10:00:00', '09:00:00', '11:30:00'] },
  { fecha: '2030-12-21', horarios: [] },
  { fecha: '2030-12-22', horarios: ['12:00:00'] },
  { fecha: '2030-12-23', horarios: ['08:00:00', '08:30:00'] },
];

const RUTA_BASE = '/sucursal/7/servicios/3/turnos?empleadoId=9';

describe('US-TURN-08 · Ver disponibilidad y elegir horario', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<TestShell>>;
  let router: Router;
  let backend: HttpTestingController;

  const auth = {
    autenticado: signal(false),
    tieneAlgunRol: vi.fn(),
    login: vi.fn(),
    perfil: signal(null),
  };

  beforeEach(async () => {
    TestBed.resetTestingModule();
    vi.resetAllMocks();
    auth.autenticado.set(false);
    auth.tieneAlgunRol.mockReturnValue(true);
    auth.login.mockImplementation(() => {
      auth.autenticado.set(true);
      return of(undefined);
    });

    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.setAttribute('open', '');
      },
    });

    await TestBed.configureTestingModule({
      imports: [TestShell],
      providers: [
        provideRouter([
          {
            path: 'sucursal/:sucursalId/servicios/:servicioId/turnos/pago',
            component: PagoTurno,
          },
          {
            path: 'sucursal/:sucursalId/servicios/:servicioId/turnos',
            component: ElegirTurno,
          },
          {
            path: 'sucursal/:sucursalId/servicios/:servicioId/empleados',
            component: Dummy,
          },
          { path: '', component: Dummy },
        ]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: authService, useValue: auth },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TestShell);
    fixture.detectChanges();
    router = TestBed.inject(Router);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    fixture.destroy();
    backend.verify();
    vi.restoreAllMocks();
  });

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function texto(elemento: HTMLElement = host()): string {
    return (elemento.textContent ?? '').replace(/\u00a0/g, ' ');
  }

  async function navegar(url = RUTA_BASE): Promise<void> {
    await router.navigateByUrl(url);
    fixture.detectChanges();
  }

  function responderContexto(
    sucursal: Record<string, unknown> = SUCURSAL,
    empleados: readonly Record<string, unknown>[] = EMPLEADOS,
  ): void {
    backend
      .expectOne((request) => request.url.endsWith('/sucursales/7'))
      .flush(sucursal);
    backend
      .expectOne((request) => request.url.endsWith('/servicios/listar/sucursal/7'))
      .flush(SERVICIOS);
    backend
      .expectOne((request) => request.url.endsWith('/sucursales/7/elegir-empleado'))
      .flush(empleados);
  }

  function responderDisponibilidad(
    dias: readonly Record<string, unknown>[] = DIAS,
    empleadoId = 9,
  ): void {
    backend
      .expectOne(
        (request) =>
          request.url.endsWith(`/turnos/disponibilidad/empleado/${empleadoId}/servicio/3`),
      )
      .flush(dias);
  }

  function responderTurnosPropios(turnos: readonly Record<string, unknown>[] = []): void {
    const pendientes = backend.match((request) =>
      request.url.endsWith('/turnos/propios'),
    );
    pendientes.forEach((request) => {
      if (!request.cancelled) {
        request.flush(turnos);
      }
    });
  }

  async function abrir(url = RUTA_BASE): Promise<HTMLElement> {
    await navegar(url);
    responderContexto();
    responderDisponibilidad();
    responderTurnosPropios();    await fixture.whenStable();
    fixture.detectChanges();
    return host();
  }

  function dias(hostElement: HTMLElement = host()): HTMLButtonElement[] {
    return Array.from(
      hostElement.querySelectorAll<HTMLButtonElement>('.dia[data-fecha]'),
    );
  }

  function horarios(hostElement: HTMLElement = host()): HTMLButtonElement[] {
    return Array.from(
      hostElement.querySelectorAll<HTMLButtonElement>('.horario[data-hora]'),
    );
  }

  function continuar(hostElement: HTMLElement = host()): HTMLButtonElement {
    return hostElement.querySelector<HTMLButtonElement>('.boton--siguiente')!;
  }

  async function seleccionarDia(fecha: string): Promise<void> {
    host()
      .querySelector<HTMLButtonElement>(`.dia[data-fecha="${fecha}"]`)
      ?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function seleccionarHora(hora: string): Promise<void> {
    host()
      .querySelector<HTMLButtonElement>(`.horario[data-hora="${hora}"]`)
      ?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('muestra el título, el paso 3 y el contexto con sucursal, servicio y profesional', async () => {
    const hostElement = await abrir();

    expect(texto()).toContain('Seleccionar día y horario');
    expect(texto()).toContain('Paso 3 de 3 · Día y horario');

    const items = hostElement.querySelectorAll<HTMLElement>('.contexto__item');
    expect(items).toHaveLength(3);

    expect(items[0]?.querySelector('.contexto__valor')?.textContent?.trim()).toBe(
      'Barber House',
    );
    expect(items[0]?.querySelector('.contexto__puntuacion')?.textContent?.trim()).toBe(
      '4/5',
    );
    expect(items[0]?.querySelectorAll('.contexto__abeja')).toHaveLength(4);

    expect(items[1]?.querySelector('.contexto__valor')?.textContent?.trim()).toBe(
      'Corte de pelo',
    );
    expect(items[1]?.querySelector('.contexto__puntuacion')?.textContent?.trim()).toBe(
      '4/5',
    );
    expect(items[1]?.querySelectorAll('.contexto__abeja')).toHaveLength(4);

    expect(items[2]?.querySelector('.contexto__valor')?.textContent?.trim()).toBe(
      'Ana Pérez',
    );
    expect(items[2]?.querySelector('.contexto__puntuacion')?.textContent?.trim()).toBe(
      '5/5',
    );
    expect(items[2]?.querySelectorAll('.contexto__abeja')).toHaveLength(5);
    expect(texto(items[2]!)).toContain('Puntuación promedio 5/5');
  });

  it('consulta la disponibilidad del empleado y servicio indicados en la URL', async () => {
    await navegar();
    responderContexto();
    const pedido = backend.expectOne(
      (request) =>
        request.url.endsWith('/turnos/disponibilidad/empleado/9/servicio/3'),
    );
    expect(pedido.request.method).toBe('GET');
    pedido.flush(DIAS);
    backend.match((request) => request.url.endsWith('/turnos/propios')).forEach((request) => {
      if (!request.cancelled) {
        request.flush([]);
      }
    });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto()).toContain('Elegí un día');
  });

  it('muestra sólo los días con horarios y los dibuja como círculos con día y mes abreviado', async () => {
    const hostElement = await abrir();
    const botones = dias(hostElement);

    expect(botones).toHaveLength(3);
    expect(botones.map((boton) => boton.getAttribute('data-fecha'))).toEqual([
      '2030-12-20',
      '2030-12-22',
      '2030-12-23',
    ]);

    expect(botones[0]?.querySelector('.dia__numero')?.textContent?.trim()).toBe('20');
    expect(botones[0]?.querySelector('.dia__mes')?.textContent?.trim()).toBe('Dic.');
    expect(botones[1]?.querySelector('.dia__numero')?.textContent?.trim()).toBe('22');
    expect(botones[2]?.querySelector('.dia__mes')?.textContent?.trim()).toBe('Dic.');

    expect(botones[0]?.getAttribute('role')).toBe('radio');
    expect(botones[0]?.getAttribute('aria-checked')).toBe('false');
    expect(botones[0]?.getAttribute('aria-label')).toContain('3 horarios disponibles');
  });

  it('muestra el panel de horarios al elegir un día, en orden ascendente y con una fila por horario', async () => {
    const hostElement = await abrir();

    expect(hostElement.querySelector('.horarios__lista')).toBeNull();
    await seleccionarDia('2030-12-20');

    const filas = horarios(hostElement);
    expect(filas).toHaveLength(3);
    expect(filas.map((fila) => fila.getAttribute('data-hora'))).toEqual([
      '09:00:00',
      '10:00:00',
      '11:30:00',
    ]);
    expect(filas.map((fila) => fila.textContent?.trim())).toEqual([
      expect.stringContaining('09:00'),
      expect.stringContaining('10:00'),
      expect.stringContaining('11:30'),
    ]);

    const lista = hostElement.querySelector('.horarios__lista');
    expect(lista?.getAttribute('role')).toBe('radiogroup');
    expect(lista?.getAttribute('aria-labelledby')).toBe('horarios-titulo');
    expect(hostElement.querySelectorAll('.horarios__lista')).toHaveLength(1);
  });

  it('mantiene «Continuar» deshabilitado hasta elegir un horario y permite uno solo', async () => {
    const hostElement = await abrir();

    expect(continuar(hostElement).disabled).toBe(true);
    expect(texto(hostElement)).toContain('Elegí un día y un horario para continuar.');

    await seleccionarDia('2030-12-20');
    expect(continuar(hostElement).disabled).toBe(true);

    await seleccionarHora('10:00:00');
    expect(continuar(hostElement).disabled).toBe(false);
    expect(hostElement.querySelectorAll('.horario--seleccionado')).toHaveLength(1);
    expect(
      hostElement.querySelector('.horario--seleccionado')?.getAttribute('aria-checked'),
    ).toBe('true');

    const resumen = hostElement.querySelector('.acciones__resumen')!;
    expect(texto(resumen as HTMLElement)).toContain('Turno seleccionado:');
    expect(texto(resumen as HTMLElement)).toContain('10:00');
    expect(texto(resumen as HTMLElement)).toContain('hs');

    await seleccionarHora('11:30:00');
    expect(hostElement.querySelectorAll('.horario--seleccionado')).toHaveLength(1);
    expect(
      hostElement.querySelector('.horario--seleccionado')?.getAttribute('data-hora'),
    ).toBe('11:30:00');
  });

  it('al cambiar de día actualiza los horarios y limpia la hora elegida', async () => {
    const hostElement = await abrir();

    await seleccionarDia('2030-12-20');
    await seleccionarHora('10:00:00');
    expect(hostElement.querySelectorAll('.horario')).toHaveLength(3);

    await seleccionarDia('2030-12-22');

    expect(hostElement.querySelectorAll('.horario')).toHaveLength(1);
    expect(hostElement.querySelector('.horario')?.getAttribute('data-hora')).toBe('12:00:00');
    expect(hostElement.querySelectorAll('.horario--seleccionado')).toHaveLength(0);
    expect(continuar(hostElement).disabled).toBe(true);
    expect(hostElement.querySelectorAll('.dia--seleccionado')).toHaveLength(1);
    expect(hostElement.querySelector('.dia--seleccionado')?.getAttribute('data-fecha')).toBe(
      '2030-12-22',
    );
  });

  it('conserva día y horario en la URL para sobrevivir a la navegación entre pasos', async () => {
    await abrir();

    await seleccionarDia('2030-12-20');
    await seleccionarHora('10:00:00');

    expect(router.parseUrl(router.url).queryParams).toEqual({
      empleadoId: '9',
      fecha: '2030-12-20',
      hora: '10:00:00',
    });

    const volver = host().querySelector<HTMLAnchorElement>('.volver')!;
    const destino = new URL(volver.href, 'http://localhost');
    expect(destino.pathname).toBe('/sucursal/7/servicios/3/empleados');
    expect(Object.fromEntries(destino.searchParams)).toEqual({
      empleadoId: '9',
      fecha: '2030-12-20',
      hora: '10:00:00',
    });
  });

  it('restaura la fecha y el horario preseleccionados desde la URL', async () => {
    const hostElement = await abrir(
      `${RUTA_BASE}&fecha=2030-12-20&hora=10:00:00`,
    );

    expect(hostElement.querySelectorAll('.dia--seleccionado')).toHaveLength(1);
    expect(hostElement.querySelector('.dia--seleccionado')?.getAttribute('data-fecha')).toBe(
      '2030-12-20',
    );
    expect(hostElement.querySelectorAll('.horario--seleccionado')).toHaveLength(1);
    expect(
      hostElement.querySelector('.horario--seleccionado')?.getAttribute('data-hora'),
    ).toBe('10:00:00');
    expect(continuar(hostElement).disabled).toBe(false);
    expect(hostElement.querySelector('.aviso')).toBeNull();
  });

  it('avisa y permite elegir otro horario si el preseleccionado ya no está disponible', async () => {
    const hostElement = await abrir(
      `${RUTA_BASE}&fecha=2030-12-20&hora=15:00:00`,
    );

    expect(texto(hostElement)).toContain(
      'El horario que intentaste preseleccionar ya no está disponible',
    );
    expect(hostElement.querySelector('.dia--seleccionado')?.getAttribute('data-fecha')).toBe(
      '2030-12-20',
    );
    expect(hostElement.querySelectorAll('.horario--seleccionado')).toHaveLength(0);
    expect(continuar(hostElement).disabled).toBe(true);

    await seleccionarHora('09:00:00');
    expect(continuar(hostElement).disabled).toBe(false);
    expect(hostElement.querySelector('.aviso')).toBeNull();
  });

  it('avisa si el día preseleccionado ya no está disponible y conserva el contexto', async () => {
    const hostElement = await abrir(
      `${RUTA_BASE}&fecha=2030-12-21&hora=10:00:00`,
    );

    expect(texto(hostElement)).toContain(
      'El día que intentaste preseleccionar ya no está disponible',
    );
    expect(hostElement.querySelectorAll('.dia--seleccionado')).toHaveLength(0);
    expect(texto(hostElement)).toContain('Barber House');
    expect(texto(hostElement)).toContain('Ana Pérez');
    expect(dias(hostElement)).toHaveLength(3);
  });

  it('permite navegar los días con flechas, Home, End, Enter y Espacio', async () => {
    const hostElement = await abrir();
    let botones = dias(hostElement);

    expect(botones[0]?.tabIndex).toBe(0);
    expect(botones[1]?.tabIndex).toBe(-1);

    const derecha = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      bubbles: true,
      cancelable: true,
    });
    botones[0]?.dispatchEvent(derecha);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(derecha.defaultPrevented).toBe(true);
    botones = dias(hostElement);
    expect(botones[1]?.getAttribute('aria-checked')).toBe('true');
    expect(botones[1]?.tabIndex).toBe(0);
    expect(document.activeElement).toBe(botones[1]);

    botones[1]?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }),
    );
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(dias(hostElement)[2]?.getAttribute('aria-checked')).toBe('true');

    dias(hostElement)[2]?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }),
    );
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(dias(hostElement)[0]?.getAttribute('aria-checked')).toBe('true');

    const espacio = new KeyboardEvent('keydown', {
      key: ' ',
      bubbles: true,
      cancelable: true,
    });
    dias(hostElement)[0]?.dispatchEvent(espacio);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(espacio.defaultPrevented).toBe(true);
    expect(horarios(hostElement)).toHaveLength(3);
    expect(document.activeElement).toBe(horarios(hostElement)[0]);
  });

  it('permite navegar los horarios con flechas y elegir con Enter', async () => {
    const hostElement = await abrir();
    await seleccionarDia('2030-12-20');

    let filas = horarios(hostElement);
    expect(filas[0]?.tabIndex).toBe(0);

    filas[0]?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }),
    );
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    filas = horarios(hostElement);
    expect(filas[1]?.getAttribute('aria-checked')).toBe('true');
    expect(document.activeElement).toBe(filas[1]);

    filas[1]?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    );
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(continuar(hostElement).disabled).toBe(false);
    expect(
      hostElement.querySelector('.horario--seleccionado')?.getAttribute('data-hora'),
    ).toBe('10:00:00');
  });

  it('muestra skeleton y aria-busy mientras carga la disponibilidad', async () => {
    await navegar();
    responderContexto();

    const hostElement = host();
    expect(hostElement.querySelectorAll('.dia--skeleton')).toHaveLength(5);
    expect(hostElement.querySelector('.disponibilidad')?.getAttribute('aria-busy')).toBe(
      'true',
    );
    expect(texto(hostElement)).toContain('Cargando días y horarios disponibles');

    responderDisponibilidad();
    responderTurnosPropios();    await fixture.whenStable();
    fixture.detectChanges();

    expect(hostElement.querySelectorAll('.dia--skeleton')).toHaveLength(0);
    expect(dias(hostElement)).toHaveLength(3);
  });

  it('muestra el estado vacío cuando el backend no devuelve días con horarios', async () => {
    await navegar();
    responderContexto();
    responderDisponibilidad([
      { fecha: '2030-12-21', horarios: [] },
      { fecha: '2030-12-22', horarios: [] },
    ]);
    responderTurnosPropios();
    await fixture.whenStable();
    fixture.detectChanges();

    const hostElement = host();
    expect(texto(hostElement)).toContain('No hay días disponibles en este momento');
    expect(hostElement.querySelector('.estado--vacio')?.getAttribute('role')).toBe(
      'status',
    );
    expect(hostElement.querySelector<HTMLAnchorElement>('.estado--vacio .boton')?.getAttribute('href')).toBe(
      '/sucursal/7/servicios/3/empleados?empleadoId=9',
    );
    expect(hostElement.querySelector('.acciones')).toBeNull();
  });

  it('muestra el error inline de disponibilidad y permite reintentar sin duplicar pedidos', async () => {
    await navegar();
    responderContexto();
    backend
      .expectOne(
        (request) =>
          request.url.endsWith('/turnos/disponibilidad/empleado/9/servicio/3'),
      )
      .flush({}, { status: 503, statusText: 'Unavailable' });
    backend.match((request) => request.url.endsWith('/turnos/propios')).forEach((request) => {
      if (!request.cancelled) {
        request.flush([]);
      }
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const hostElement = host();
    expect(texto(hostElement)).toContain('No pudimos cargar los horarios');
    const alerta = hostElement.querySelector('.aviso--error');
    expect(alerta?.getAttribute('role')).toBe('alert');
    expect(alerta?.getAttribute('aria-live')).toBe('assertive');

    const reintentar = alerta?.querySelector<HTMLButtonElement>('.boton')!;
    expect(reintentar.textContent?.trim()).toBe('Reintentar');
    reintentar.click();
    reintentar.click();
    fixture.detectChanges();

    const reintentando = hostElement.querySelector<HTMLButtonElement>(
      '.aviso--error .boton',
    )!;
    expect(reintentando.disabled).toBe(true);
    expect(reintentando.getAttribute('aria-busy')).toBe('true');
    expect(reintentando.textContent).toContain('Reintentando');

    responderDisponibilidad();
    responderTurnosPropios();    await fixture.whenStable();
    fixture.detectChanges();

    expect(hostElement.querySelector('.aviso--error')).toBeNull();
    expect(dias(hostElement)).toHaveLength(3);
    expect(continuar(hostElement).disabled).toBe(true);
  });

  it('si falla una recarga conserva los días y la selección ya cargados', async () => {
    const hostElement = await abrir();
    await seleccionarDia('2030-12-20');
    await seleccionarHora('10:00:00');

    const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    window.dispatchEvent(new Event('offline'));
    fixture.detectChanges();

    const reintentar = hostElement.querySelector<HTMLButtonElement>(
      '.aviso--conexion .boton',
    )!;
    reintentar.click();
    fixture.detectChanges();

    backend
      .expectOne(
        (request) =>
          request.url.endsWith('/turnos/disponibilidad/empleado/9/servicio/3'),
      )
      .flush({}, { status: 503, statusText: 'Unavailable' });
    backend.match((request) => request.url.endsWith('/turnos/propios')).forEach((request) => {
      if (!request.cancelled) {
        request.flush([]);
      }
    });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(hostElement.querySelector('.aviso--error')).not.toBeNull();
    expect(dias(hostElement)).toHaveLength(3);
    expect(hostElement.querySelectorAll('.horario--seleccionado')).toHaveLength(1);
    expect(hostElement.querySelector('.horario--seleccionado')?.getAttribute('data-hora')).toBe(
      '10:00:00',
    );
    expect(continuar(hostElement).disabled).toBe(false);
    onLine.mockRestore();
  });

  it('muestra un mensaje específico sin conexión y reintenta cuando vuelve la red', async () => {
    const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

    await navegar();
    responderContexto();
    backend
      .expectOne(
        (request) =>
          request.url.endsWith('/turnos/disponibilidad/empleado/9/servicio/3'),
      )
      .flush({}, { status: 0, statusText: 'Unknown Error' });
    await fixture.whenStable();
    fixture.detectChanges();

    const hostElement = host();
    expect(texto(hostElement)).toContain('Sin conexión a internet');
    expect(texto(hostElement)).toContain('Revisá tu conexión');

    const reintentar = hostElement.querySelector<HTMLButtonElement>(
      '.aviso--error .boton',
    )!;
    reintentar.click();
    fixture.detectChanges();
    expect(
      hostElement.querySelector<HTMLButtonElement>('.aviso--error .boton')?.disabled,
    ).toBe(true);

    onLine.mockReturnValue(true);
    window.dispatchEvent(new Event('online'));
    fixture.detectChanges();
    expect(texto(hostElement)).toContain('La conexión volvió');

    responderDisponibilidad();
    responderTurnosPropios();    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto(hostElement)).not.toContain('Sin conexión a internet');
    expect(dias(hostElement)).toHaveLength(3);
  });

  it('al perder la conexión conserva lo cargado y ofrece reintentar', async () => {
    const hostElement = await abrir();

    const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    window.dispatchEvent(new Event('offline'));
    fixture.detectChanges();

    const aviso = hostElement.querySelector('.aviso--conexion');
    expect(aviso).not.toBeNull();
    expect(aviso?.getAttribute('role')).toBe('alert');
    expect(texto(hostElement)).toContain('Sin conexión a internet');
    expect(dias(hostElement)).toHaveLength(3);

    onLine.mockReturnValue(true);
    window.dispatchEvent(new Event('online'));
    fixture.detectChanges();
    expect(hostElement.querySelector('.aviso--conexion')).toBeNull();
  });

  it('muestra el error de contexto y permite reintentar sin perder la disponibilidad', async () => {
    await navegar();
    backend
      .expectOne((request) => request.url.endsWith('/sucursales/7'))
      .flush(SUCURSAL);
    backend
      .expectOne((request) => request.url.endsWith('/servicios/listar/sucursal/7'))
      .flush(SERVICIOS);
    backend
      .expectOne((request) => request.url.endsWith('/sucursales/7/elegir-empleado'))
      .flush({}, { status: 500, statusText: 'Server Error' });
    responderDisponibilidad();
    responderTurnosPropios();    await fixture.whenStable();
    fixture.detectChanges();

    const hostElement = host();
    expect(texto(hostElement)).toContain('No pudimos cargar los datos de la reserva');
    expect(hostElement.querySelector('.aviso--error')?.getAttribute('role')).toBe(
      'alert',
    );
    expect(dias(hostElement)).toHaveLength(3);

    const reintentar = hostElement.querySelector<HTMLButtonElement>(
      '.aviso--error .boton',
    )!;
    reintentar.click();
    fixture.detectChanges();
    expect(reintentar.disabled).toBe(true);

    backend
      .expectOne((request) => request.url.endsWith('/sucursales/7'))
      .flush(SUCURSAL);
    backend
      .expectOne((request) => request.url.endsWith('/servicios/listar/sucursal/7'))
      .flush(SERVICIOS);
    backend
      .expectOne((request) => request.url.endsWith('/sucursales/7/elegir-empleado'))
      .flush(EMPLEADOS);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(hostElement.querySelector('.aviso--error')).toBeNull();
    expect(texto(hostElement)).toContain('Ana Pérez');
  });

  it('sin empleado en la URL muestra el error de contexto sin pedir datos', async () => {
    await navegar('/sucursal/7/servicios/3/turnos');

    expect(texto()).toContain('No pudimos identificar la reserva');
    expect(host().querySelector('.estado--contexto .boton')?.getAttribute('href')).toBe(
      '/',
    );
    backend.expectNone(
      (request) => request.url.includes('/turnos/disponibilidad/empleado/'),
    );
  });

  it('abre el modal de login al continuar sin sesión y no navega', async () => {
    await abrir();
    await seleccionarDia('2030-12-20');
    await seleccionarHora('10:00:00');

    const navegar = vi.spyOn(router, 'navigate');
    continuar().click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(host().querySelector('app-login-modal')).not.toBeNull();
    expect(host().querySelector('dialog[open]')).not.toBeNull();
    const login = fixture.debugElement.query(By.directive(LoginPage))
      .componentInstance as LoginPage;
    expect(login.destinoRetorno()).toContain('/sucursal/7/servicios/3/turnos');
    expect(login.destinoRetorno()).toContain('fecha=2030-12-20');
    expect(login.destinoRetorno()).toContain('hora=10:00:00');
    expect(navegar).not.toHaveBeenCalledWith(
      ['/sucursal', 7, 'servicios', 3, 'turnos', 'pago'],
      expect.anything(),
    );

    host().querySelector<HTMLButtonElement>('.login-modal__cerrar')?.click();
    fixture.detectChanges();
    expect(host().querySelector('app-login-modal')).toBeNull();
  });

  it('después de iniciar sesión con rol Cliente continúa al enlace de pago', async () => {
    await abrir();
    await seleccionarDia('2030-12-20');
    await seleccionarHora('10:00:00');

    continuar().click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const login = fixture.debugElement.query(By.directive(LoginPage))
      .componentInstance as LoginPage;
    login.loginModel.set({ email: 'ana@example.com', password: 'Clave123!' });
    login.onSubmit(new Event('submit', { cancelable: true }));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    responderContexto();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(auth.login).toHaveBeenCalledWith('ana@example.com', 'Clave123!');
    expect(router.url).toContain('/sucursal/7/servicios/3/turnos/pago');
    const query = router.parseUrl(router.url).queryParams;
    expect(query).toEqual({
      empleadoId: '9',
      fecha: '2030-12-20',
      hora: '10:00:00',
    });
    expect(texto()).toContain('Enlace de pago');
    expect(texto()).toContain('Pagar con Mercado Pago');
  });

  it('con sesión pero sin rol Cliente informa permiso y ofrece salida al Home', async () => {
    auth.autenticado.set(true);
    auth.tieneAlgunRol.mockReturnValue(false);
    await abrir();
    await seleccionarDia('2030-12-20');
    await seleccionarHora('10:00:00');

    continuar().click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto()).toContain('Tu cuenta no tiene permiso para reservar');
    expect(host().querySelector<HTMLAnchorElement>('.aviso__salida')?.getAttribute('href')).toBe('/');
    expect(router.url).toContain('/turnos?');
    expect(host().querySelector('app-login-modal')).toBeNull();
  });

  it('con sesión Cliente navega al enlace de pago conservando la selección', async () => {
    auth.autenticado.set(true);
    auth.tieneAlgunRol.mockReturnValue(true);
    await abrir();
    await seleccionarDia('2030-12-20');
    await seleccionarHora('10:00:00');

    continuar().click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    responderContexto();
    await fixture.whenStable();
    fixture.detectChanges();

    const destino = router.parseUrl(router.url);
    expect(destino.root.children['primary']?.segments.map((segmento) => segmento.path)).toEqual(
      ['sucursal', '7', 'servicios', '3', 'turnos', 'pago'],
    );
    expect(destino.queryParams).toEqual({
      empleadoId: '9',
      fecha: '2030-12-20',
      hora: '10:00:00',
    });
    expect(texto()).toContain('Enlace de pago');
  });

  it('bloquea navegaciones duplicadas mientras se procesa el paso final', async () => {
    auth.autenticado.set(true);
    auth.tieneAlgunRol.mockReturnValue(true);
    await abrir();
    await seleccionarDia('2030-12-20');
    await seleccionarHora('10:00:00');

    const navegar = vi
      .spyOn(router, 'navigate')
      .mockReturnValue(Promise.resolve(true));
    const boton = continuar();

    boton.click();
    boton.click();
    fixture.detectChanges();

    expect(navegar).toHaveBeenCalledTimes(1);
    expect(navegar).toHaveBeenCalledWith(
      ['/sucursal', 7, 'servicios', 3, 'turnos', 'pago'],
      { queryParams: { empleadoId: 9, fecha: '2030-12-20', hora: '10:00:00' } },
    );
    expect(boton.disabled).toBe(true);
    expect(boton.getAttribute('aria-busy')).toBe('true');

    navegar.mockRestore();
  });
});
