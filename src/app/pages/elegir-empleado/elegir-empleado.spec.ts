import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, RouterOutlet, provideRouter } from '@angular/router';

import { ElegirEmpleado } from './elegir-empleado';

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

const SERVICIOS = [
  {
    id: 1,
    nombre: 'Corte de pelo',
    descripcion: 'Corte clásico con lavado',
    duracion: 45,
    precio: 12500,
    fotoPerfil: null,
    puntuacion: 4,
    cantidadPuntuaciones: 12,
    nombreSucursal: 'Sucursal Flores',
  },
];

const SUCURSAL = {
  id: 7,
  nombre: 'Sucursal Flores',
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

const EMPLEADOS = [
  {
    id: 10,
    nombre: 'Ana',
    apellido: 'Gómez',
    urlFotoPerfil: 'https://example.com/ana.jpg',
    puntuacion: 4,
    cantidadPuntuaciones: 12,
  },
  {
    id: 11,
    nombre: 'Bruno',
    apellido: 'Díaz',
    urlFotoPerfil: null,
    puntuacion: null,
    cantidadPuntuaciones: 0,
  },
];

const RUTA_BASE = '/sucursal/7/servicios/1/empleados';

describe('US-TURN-07 · Elegir empleado', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<TestShell>>;
  let router: Router;
  let backend: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestShell],
      providers: [
        provideRouter([
          { path: 'sucursal/:sucursalId/servicios/:servicioId/empleados', component: ElegirEmpleado },
          { path: 'sucursal/:sucursalId/servicios/:servicioId/turnos', component: Dummy },
          { path: 'sucursal/:sucursalId/servicios', component: Dummy },
          { path: 'sucursal/:id', component: Dummy },
          { path: 'empleados', component: ElegirEmpleado },
          { path: '', component: Dummy },
        ]),
        provideHttpClient(),
        provideHttpClientTesting(),
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

  async function abrir(url: string): Promise<HTMLElement> {
    await router.navigateByUrl(url);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  async function abrirConEmpleados(
    empleados: readonly Record<string, unknown>[] = EMPLEADOS,
    url = RUTA_BASE,
    servicios: readonly Record<string, unknown>[] = SERVICIOS,
    sucursal: Record<string, unknown> = SUCURSAL,
  ): Promise<HTMLElement> {
    await router.navigateByUrl(url);
    fixture.detectChanges();

    backend
      .expectOne((request) => request.url.endsWith('/sucursales/7'))
      .flush(sucursal);
    backend
      .expectOne((request) => request.url.endsWith('/servicios/listar/sucursal/7'))
      .flush(servicios);
    backend
      .expectOne((request) => request.url.endsWith('/sucursales/7/elegir-empleado'))
      .flush(empleados);
    await fixture.whenStable();
    fixture.detectChanges();

    return fixture.nativeElement as HTMLElement;
  }

  function texto(host: HTMLElement): string {
    return (host.textContent ?? '').replace(/\u00a0/g, ' ');
  }

  function tarjetas(host: HTMLElement): HTMLButtonElement[] {
    return Array.from(host.querySelectorAll<HTMLButtonElement>('.empleado__seleccion'));
  }

  it('consume el endpoint de empleados y muestra foto, nombre, apellido, puntuación y abejas', async () => {
    const host = await abrirConEmpleados();
    const contenido = texto(host);
    const botones = tarjetas(host);

    expect(contenido).toContain('Elegir empleado');
    expect(contenido).toContain('Paso 2 de 3 · Empleado');
    expect(contenido).toContain('Sucursal Flores');
    expect(contenido).toContain('Corte de pelo');
    expect(contenido).toContain('Ana Gómez');
    expect(contenido).toContain('Bruno Díaz');
    expect(contenido).toContain('4/5');
    expect(contenido).toContain('Sin puntuaciones');

    expect(host.querySelectorAll('.empleado:not(.empleado--skeleton)')).toHaveLength(2);
    expect(botones).toHaveLength(2);

    const imagenes = host.querySelectorAll<HTMLImageElement>('.empleado__foto');
    expect(imagenes).toHaveLength(2);
    expect(imagenes[0]?.getAttribute('src')).toBe('https://example.com/ana.jpg');
    expect(imagenes[0]?.getAttribute('alt')).toBe('Fotografía de Ana Gómez');
    expect(imagenes[1]?.getAttribute('src')).toMatch(/^data:image\/svg\+xml/);

    const primerEmpleado = host.querySelectorAll<HTMLElement>('.empleado')[0];
    expect(primerEmpleado?.querySelectorAll('.empleado__abeja')).toHaveLength(4);
    expect(primerEmpleado?.querySelector('.sr-only')?.textContent).toContain(
      'Puntuación promedio 4/5',
    );

    const segundoEmpleado = host.querySelectorAll<HTMLElement>('.empleado')[1];
    expect(segundoEmpleado?.querySelectorAll('.empleado__abeja')).toHaveLength(0);
  });

  it('muestra el nombre y el promedio de reseñas de la sucursal y del servicio', async () => {
    const host = await abrirConEmpleados();
    const items = host.querySelectorAll<HTMLElement>('.contexto__item');

    expect(items).toHaveLength(2);

    const sucursal = items[0]!;
    expect(sucursal.querySelector('.contexto__valor')?.textContent?.trim()).toBe(
      'Sucursal Flores',
    );
    expect(sucursal.querySelector('.contexto__puntuacion')?.textContent?.trim()).toBe(
      '4/5',
    );
    expect(sucursal.querySelectorAll('.contexto__abeja')).toHaveLength(4);
    expect(texto(sucursal)).toContain('Puntuación promedio 4/5');

    const servicio = items[1]!;
    expect(servicio.querySelector('.contexto__valor')?.textContent?.trim()).toBe(
      'Corte de pelo',
    );
    expect(servicio.querySelector('.contexto__puntuacion')?.textContent?.trim()).toBe(
      '4/5',
    );
    expect(servicio.querySelectorAll('.contexto__abeja')).toHaveLength(4);
    expect(texto(servicio)).toContain('Puntuación promedio 4/5');
  });

  it('indica cuando la sucursal o el servicio todavía no tienen reseñas', async () => {
    const host = await abrirConEmpleados(
      EMPLEADOS,
      RUTA_BASE,
      [{ ...SERVICIOS[0], puntuacion: null, cantidadPuntuaciones: 0 }],
      { ...SUCURSAL, puntuacion: null, cantidadPuntuaciones: 0 },
    );

    expect(host.querySelectorAll('.contexto__item')).toHaveLength(2);
    expect(host.querySelectorAll('.contexto__sin-puntuacion')).toHaveLength(2);
    expect(host.querySelectorAll('.contexto__abeja')).toHaveLength(0);
    expect(texto(host)).toContain('Todavía no tiene reseñas.');
  });

  it('mantiene una única columna para el listado vertical', async () => {
    const host = await abrirConEmpleados();
    const lista = host.querySelector<HTMLElement>('.lista');

    expect(lista).not.toBeNull();
    expect(lista?.getAttribute('role')).toBe('radiogroup');
    expect(lista?.getAttribute('aria-labelledby')).toBe('elegir-empleado-titulo');
    expect(host.querySelectorAll('.lista')).toHaveLength(1);
  });

  it('selecciona un único empleado y sincroniza aria-checked con el estado visual', async () => {
    const host = await abrirConEmpleados();
    let botones = tarjetas(host);

    expect(botones[0]?.getAttribute('role')).toBe('radio');
    expect(botones[0]?.getAttribute('aria-checked')).toBe('false');
    expect(botones[1]?.getAttribute('aria-checked')).toBe('false');
    expect(botones[0]?.getAttribute('aria-label')).toBe('Seleccionar a Ana Gómez');
    expect(botones[0]?.tabIndex).toBe(0);
    expect(botones[1]?.tabIndex).toBe(-1);

    botones[0]?.click();
    fixture.detectChanges();

    botones = tarjetas(host);
    expect(botones[0]?.getAttribute('aria-checked')).toBe('true');
    expect(botones[1]?.getAttribute('aria-checked')).toBe('false');
    expect(botones[0]?.tabIndex).toBe(0);
    expect(botones[1]?.tabIndex).toBe(-1);
    expect(host.querySelectorAll('.empleado--seleccionada')).toHaveLength(1);
    expect(host.querySelectorAll('.empleado__check')).toHaveLength(1);
    expect(texto(host)).toContain('Empleado seleccionado:');

    const resumen = host.querySelector<HTMLElement>('.acciones__resumen')!;
    expect(resumen.querySelector('.acciones__nombre')?.textContent?.trim()).toBe(
      'Ana Gómez',
    );
    expect(
      resumen.querySelector('.acciones__nombre + .acciones__resumen-meta'),
    ).not.toBeNull();
    expect(
      resumen.querySelector('.acciones__puntuacion')?.textContent?.trim(),
    ).toBe('4/5');
    expect(resumen.querySelectorAll('.acciones__abeja')).toHaveLength(4);

    botones[1]?.click();
    fixture.detectChanges();

    botones = tarjetas(host);
    expect(botones[0]?.getAttribute('aria-checked')).toBe('false');
    expect(botones[1]?.getAttribute('aria-checked')).toBe('true');
    expect(host.querySelectorAll('.empleado--seleccionada')).toHaveLength(1);
    expect(texto(host)).toContain('Bruno Díaz');
    expect(texto(host)).not.toContain('Empleado seleccionado: Ana Gómez');
    expect(
      host.querySelector('.acciones__sin-puntuacion')?.textContent?.trim(),
    ).toBe('Nadie lo ha puntuado aún.');
    expect(host.querySelector('.acciones__resumen-meta')).toBeNull();
  });

  it('selecciona con Enter y con barra espaciadora', async () => {
    const host = await abrirConEmpleados();
    let botones = tarjetas(host);

    const enter = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    });
    botones[0]?.dispatchEvent(enter);
    fixture.detectChanges();

    expect(enter.defaultPrevented).toBe(true);
    botones = tarjetas(host);
    expect(botones[0]?.getAttribute('aria-checked')).toBe('true');
    expect(texto(host.querySelector('.acciones__resumen')!)).toContain('Ana Gómez');

    const espacio = new KeyboardEvent('keydown', {
      key: ' ',
      bubbles: true,
      cancelable: true,
    });
    botones[1]?.dispatchEvent(espacio);
    fixture.detectChanges();

    expect(espacio.defaultPrevented).toBe(true);
    botones = tarjetas(host);
    expect(botones[0]?.getAttribute('aria-checked')).toBe('false');
    expect(botones[1]?.getAttribute('aria-checked')).toBe('true');
    expect(texto(host.querySelector('.acciones__resumen')!)).toContain('Bruno Díaz');
  });

  it('navega con las flechas, Home y End acompañando la selección con el foco', async () => {
    const host = await abrirConEmpleados();
    let botones = tarjetas(host);

    botones[0]?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }),
    );
    fixture.detectChanges();

    botones = tarjetas(host);
    expect(botones[1]?.getAttribute('aria-checked')).toBe('true');
    expect(botones[1]?.tabIndex).toBe(0);
    expect(botones[0]?.tabIndex).toBe(-1);
    expect(document.activeElement).toBe(botones[1]);

    botones[1]?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }),
    );
    fixture.detectChanges();

    botones = tarjetas(host);
    expect(botones[0]?.getAttribute('aria-checked')).toBe('true');
    expect(document.activeElement).toBe(botones[0]);

    botones[0]?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }),
    );
    fixture.detectChanges();

    expect(tarjetas(host)[1]?.getAttribute('aria-checked')).toBe('true');

    tarjetas(host)[1]?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }),
    );
    fixture.detectChanges();

    expect(tarjetas(host)[0]?.getAttribute('aria-checked')).toBe('true');
  });

  it('mantiene «Siguiente» deshabilitado sin selección', async () => {
    const host = await abrirConEmpleados();
    const siguiente = () => host.querySelector<HTMLButtonElement>('.boton--siguiente')!;

    expect(siguiente().textContent?.trim()).toBe('Siguiente');
    expect(siguiente().disabled).toBe(true);
    expect(texto(host)).toContain('Elegí un empleado para continuar.');

    siguiente().click();
    await fixture.whenStable();
    expect(router.url).toBe(RUTA_BASE);

    tarjetas(host)[0]?.click();
    fixture.detectChanges();
    expect(siguiente().disabled).toBe(false);
  });

  it('continúa al paso 3 conservando sucursal, servicio y empleado elegido', async () => {
    const host = await abrirConEmpleados();

    tarjetas(host)[1]?.click();
    fixture.detectChanges();
    host.querySelector<HTMLButtonElement>('.boton--siguiente')?.click();
    await fixture.whenStable();

    expect(router.url).toBe('/sucursal/7/servicios/1/turnos?empleadoId=11');
  });

  it('bloquea navegaciones duplicadas mientras se procesa el paso 3', async () => {
    const host = await abrirConEmpleados();

    tarjetas(host)[0]?.click();
    fixture.detectChanges();

    const navegar = vi.spyOn(router, 'navigate').mockReturnValue(Promise.resolve(true));
    const siguiente = host.querySelector<HTMLButtonElement>('.boton--siguiente')!;

    siguiente.click();
    siguiente.click();
    fixture.detectChanges();

    expect(navegar).toHaveBeenCalledTimes(1);
    expect(navegar).toHaveBeenCalledWith(
      ['/sucursal', 7, 'servicios', 1, 'turnos'],
      { queryParams: { empleadoId: 10 } },
    );
    expect(siguiente.disabled).toBe(true);
    expect(siguiente.getAttribute('aria-busy')).toBe('true');
    expect(host.querySelectorAll('.empleado--seleccionada')).toHaveLength(1);

    navegar.mockRestore();
  });

  it('preselecciona el empleado indicado por URL cuando existe', async () => {
    const host = await abrirConEmpleados(EMPLEADOS, `${RUTA_BASE}?empleadoId=11`);
    const botones = tarjetas(host);

    expect(botones[0]?.getAttribute('aria-checked')).toBe('false');
    expect(botones[1]?.getAttribute('aria-checked')).toBe('true');
    expect(botones[1]?.tabIndex).toBe(0);
    expect(host.querySelectorAll('.empleado--seleccionada')).toHaveLength(1);
    expect(host.querySelector('.aviso')).toBeNull();

    const resumen = texto(host.querySelector('.acciones__resumen')!);
    expect(resumen).toContain('Bruno Díaz');
    expect(host.querySelector<HTMLButtonElement>('.boton--siguiente')?.disabled).toBe(false);
  });

  it('si el empleado de la URL no existe avisa y no deja una selección inválida', async () => {
    const host = await abrirConEmpleados(EMPLEADOS, `${RUTA_BASE}?empleadoId=99`);

    expect(texto(host)).toContain('ya no está disponible');
    expect(host.querySelectorAll('.aviso')).toHaveLength(1);
    expect(host.querySelectorAll('.empleado--seleccionada')).toHaveLength(0);
    expect(tarjetas(host).every((boton) => boton.getAttribute('aria-checked') === 'false')).toBe(
      true,
    );
    expect(host.querySelector<HTMLButtonElement>('.boton--siguiente')?.disabled).toBe(true);
  });

  it('no selecciona automáticamente si el empleadoId de la URL no es válido', async () => {
    const host = await abrirConEmpleados(EMPLEADOS, `${RUTA_BASE}?empleadoId=invalido`);

    expect(host.querySelectorAll('.empleado--seleccionada')).toHaveLength(0);
    expect(host.querySelector('.aviso')).toBeNull();
    expect(host.querySelector<HTMLButtonElement>('.boton--siguiente')?.disabled).toBe(true);
  });

  it('muestra tarjetas skeleton y aria-busy mientras cargan los empleados', async () => {
    await router.navigateByUrl(RUTA_BASE);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelectorAll('.empleado--skeleton')).toHaveLength(4);
    expect(host.querySelector('.empleados__scroll')?.getAttribute('aria-busy')).toBe('true');
    expect(texto(host)).toContain('Cargando empleados');
    expect(host.querySelector('[aria-live="polite"]')).not.toBeNull();

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

    expect(host.querySelectorAll('.empleado--skeleton')).toHaveLength(0);
    expect(texto(host)).toContain('Ana Gómez');
  });

  it('con una sucursal sin empleados muestra el estado vacío y vuelve a servicios', async () => {
    const host = await abrirConEmpleados([], RUTA_BASE);

    expect(texto(host)).toContain('Esta sucursal todavía no tiene empleados disponibles');
    const vacio = host.querySelector('.estado--vacio');
    expect(vacio?.getAttribute('role')).toBe('status');
    expect(vacio?.getAttribute('aria-live')).toBe('polite');
    const volver = vacio?.querySelector<HTMLAnchorElement>('.boton');
    expect(volver?.textContent?.trim()).toBe('Volver a servicios');
    expect(volver?.getAttribute('href')).toBe('/sucursal/7/servicios?servicioId=1');
  });

  it('sin sucursal ni servicio muestra el error de contexto sin pedir datos', async () => {
    const host = await abrir('/empleados');

    expect(texto(host)).toContain('No pudimos identificar la reserva');
    const home = host.querySelector<HTMLAnchorElement>('.estado--contexto .boton');
    expect(home?.textContent?.trim()).toBe('Volver al Home');
    expect(home?.getAttribute('href')).toBe('/');
  });

  it('«Volver a servicios» conserva la sucursal y el servicio de la reserva', async () => {
    const host = await abrirConEmpleados();
    const volver = host.querySelector<HTMLAnchorElement>('.volver');

    expect(volver?.textContent?.trim()).toContain('Volver a servicios');
    expect(volver?.getAttribute('href')).toBe('/sucursal/7/servicios?servicioId=1');
  });

  it('ante una falla muestra el error inline, conserva el contexto y permite reintentar', async () => {
    const alerta = vi.spyOn(window, 'alert').mockImplementation(() => {});

    await router.navigateByUrl(RUTA_BASE);
    fixture.detectChanges();

    backend
      .expectOne((request) => request.url.endsWith('/sucursales/7'))
      .flush(SUCURSAL);
    backend
      .expectOne((request) => request.url.endsWith('/servicios/listar/sucursal/7'))
      .flush(SERVICIOS);
    backend
      .expectOne((request) => request.url.endsWith('/sucursales/7/elegir-empleado'))
      .flush({}, { status: 503, statusText: 'Unavailable' });
    await fixture.whenStable();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(texto(host)).toContain('No pudimos cargar los empleados');
    expect(texto(host)).toContain('Sucursal Flores');
    expect(router.url).toBe(RUTA_BASE);
    expect(alerta).not.toHaveBeenCalled();

    const estadoError = host.querySelector('.estado--error');
    expect(estadoError?.getAttribute('role')).toBe('alert');
    expect(estadoError?.getAttribute('aria-live')).toBe('assertive');

    const reintentar = host.querySelector<HTMLButtonElement>('.estado--error button.boton');
    expect(reintentar?.textContent?.trim()).toBe('Reintentar');
    reintentar?.click();
    reintentar?.click();
    fixture.detectChanges();
    expect(reintentar?.disabled).toBe(true);
    expect(reintentar?.getAttribute('aria-busy')).toBe('true');
    expect(reintentar?.textContent).toContain('Reintentando');
    expect(texto(host)).toContain('Reintentando la carga de empleados');

    backend
      .expectOne((request) => request.url.endsWith('/servicios/listar/sucursal/7'))
      .flush(SERVICIOS);
    backend
      .expectOne((request) => request.url.endsWith('/sucursales/7/elegir-empleado'))
      .flush(EMPLEADOS);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto(host)).toContain('Ana Gómez');
    expect(texto(host)).toContain('Sucursal Flores');
    expect(host.querySelector('.estado--error')).toBeNull();
  });

  it('si falla el detalle del servicio conserva la reserva con datos de contexto de respaldo', async () => {
    await router.navigateByUrl(RUTA_BASE);
    fixture.detectChanges();

    backend
      .expectOne((request) => request.url.endsWith('/sucursales/7'))
      .flush(SUCURSAL);
    backend
      .expectOne((request) => request.url.endsWith('/servicios/listar/sucursal/7'))
      .flush({}, { status: 500, statusText: 'Server Error' });
    backend
      .expectOne((request) => request.url.endsWith('/sucursales/7/elegir-empleado'))
      .flush(EMPLEADOS);
    await fixture.whenStable();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(texto(host)).toContain('Sucursal Flores');
    expect(texto(host)).toContain('Servicio #1');
    expect(host.querySelector('.contexto__item:first-child .contexto__puntuacion'))
      .not.toBeNull();
    expect(texto(host)).toContain('Ana Gómez');
    expect(host.querySelector('.estado--error')).toBeNull();
  });

  it('sin conexión muestra un mensaje específico y permite reintentar', async () => {
    const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

    await router.navigateByUrl(RUTA_BASE);
    fixture.detectChanges();

    backend
      .expectOne((request) => request.url.endsWith('/sucursales/7'))
      .flush(SUCURSAL);
    backend
      .expectOne((request) => request.url.endsWith('/servicios/listar/sucursal/7'))
      .flush(SERVICIOS);
    backend
      .expectOne((request) => request.url.endsWith('/sucursales/7/elegir-empleado'))
      .flush({}, { status: 0, statusText: 'Unknown Error' });
    await fixture.whenStable();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(texto(host)).toContain('Sin conexión a internet');
    expect(texto(host)).toContain('Revisá tu conexión');

    const reintentar = host.querySelector<HTMLButtonElement>('.estado--error button.boton');
    expect(reintentar?.textContent?.trim()).toBe('Reintentar');
    reintentar?.click();
    fixture.detectChanges();
    expect(reintentar?.disabled).toBe(true);

    const servicios = backend.expectOne((request) =>
      request.url.endsWith('/servicios/listar/sucursal/7'),
    );
    const empleados = backend.expectOne((request) =>
      request.url.endsWith('/sucursales/7/elegir-empleado'),
    );
    onLine.mockReturnValue(true);
    window.dispatchEvent(new Event('online'));
    fixture.detectChanges();
    expect(texto(host)).toContain('La conexión volvió');

    servicios.flush(SERVICIOS);
    empleados.flush(EMPLEADOS);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto(host)).toContain('Ana Gómez');
    expect(host.querySelector('.estado--error')).toBeNull();
  });

  it('al perder la conexión conserva los empleados cargados y ofrece reintentar', async () => {
    const host = await abrirConEmpleados();

    const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    window.dispatchEvent(new Event('offline'));
    fixture.detectChanges();

    const aviso = host.querySelector('.aviso--conexion');
    expect(aviso).not.toBeNull();
    expect(aviso?.getAttribute('role')).toBe('alert');
    expect(aviso?.getAttribute('aria-live')).toBe('assertive');
    expect(texto(host)).toContain('Sin conexión a internet');
    expect(texto(host)).toContain('Ana Gómez');
    expect(aviso?.querySelector('button')?.textContent?.trim()).toBe('Reintentar');

    onLine.mockReturnValue(true);
    window.dispatchEvent(new Event('online'));
    fixture.detectChanges();
    expect(host.querySelector('.aviso--conexion')).toBeNull();
  });

  it('usa el fallback cuando una imagen no se puede cargar', async () => {
    const host = await abrirConEmpleados([EMPLEADOS[0]]);

    const imagen = host.querySelector<HTMLImageElement>('.empleado__foto')!;
    imagen.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    expect(imagen.getAttribute('src')).toMatch(/^data:image\/svg\+xml/);
  });
});
