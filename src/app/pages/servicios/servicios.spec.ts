import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, RouterOutlet, provideRouter } from '@angular/router';

import { Servicios } from './servicios';

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
  nombre: 'Sucursal Flores',
  direccion: 'Av. Rivadavia 123',
  categoria: 'CAFE',
  puntuacion: 4,
  cantidadPuntuaciones: 12,
};

const SERVICIOS = [
  {
    id: 1,
    nombre: 'Corte de pelo',
    descripcion: 'Corte clásico con lavado',
    duracion: 45,
    precio: 12500,
    fotoPerfil: 'https://example.com/corte.jpg',
    puntuacion: 4,
    cantidadPuntuaciones: 12,
    nombreSucursal: 'Sucursal Flores',
  },
  {
    id: 2,
    nombre: 'Color',
    descripcion: null,
    duracion: 90,
    precio: '18000.50',
    fotoPerfil: null,
    puntuacion: null,
    cantidadPuntuaciones: 0,
    nombreSucursal: 'Sucursal Flores',
  },
];

const DESCRIPCION_LARGA =
  'Un tratamiento completo que incluye diagnóstico del cuero cabelludo, limpieza profunda, ' +
  'hidratación, masaje relajante y peinado final con productos profesionales. ' +
  'La duración puede variar según el largo y el estado del cabello. ' +
  'Se recomienda llegar unos minutos antes del turno para completar la entrevista inicial.';

describe('US-SERV-02 · Seleccionar servicio', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<TestShell>>;
  let router: Router;
  let backend: HttpTestingController;

  beforeEach(async () => {
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [TestShell],
      providers: [
        provideRouter([
          { path: 'sucursal/:sucursalId/servicios/:servicioId/empleados', component: Dummy },
          { path: 'sucursal/:sucursalId/servicios/:servicioId/turnos', component: Dummy },
          { path: 'sucursal/:sucursalId/servicios', component: Servicios },
          { path: 'servicios', component: Servicios },
          { path: 'sucursal/:sucursalId/servicios/:servicioId/turnos', component: Dummy },
          { path: 'sucursal/:id', component: Dummy },
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
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  async function abrir(url: string): Promise<HTMLElement> {
    await router.navigateByUrl(url);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  async function abrirConServicios(
    servicios: readonly Record<string, unknown>[] = SERVICIOS,
    url = '/sucursal/7/servicios',
    sucursal: Record<string, unknown> = SUCURSAL,
  ): Promise<HTMLElement> {
    await router.navigateByUrl(url);
    fixture.detectChanges();

    backend.expectOne((request) => request.url.endsWith('/sucursales/7')).flush(sucursal);
    backend
      .expectOne((request) => request.url.endsWith('/servicios/listar/sucursal/7'))
      .flush(servicios);
    await fixture.whenStable();
    fixture.detectChanges();

    return fixture.nativeElement as HTMLElement;
  }

  function texto(host: HTMLElement): string {
    return (host.textContent ?? '').replace(/\u00a0/g, ' ');
  }

  function tarjetas(host: HTMLElement): HTMLButtonElement[] {
    return Array.from(host.querySelectorAll<HTMLButtonElement>('.card__seleccion'));
  }

  it('muestra la sucursal, el título, la imagen, la duración y el precio formateado', async () => {
    const host = await abrirConServicios();
    const contenido = texto(host);

    expect(contenido).toContain('Seleccionar servicio');
    expect(contenido).toContain('Sucursal Flores');
    expect(contenido).toContain('Paso 1 de 3 · Servicio');
    expect(contenido).toContain('Corte de pelo');
    expect(contenido).toContain('45 min');
    expect(contenido).toContain('Color');
    expect(contenido).toContain('1 h 30 min');
    expect(contenido).toContain('$ 12.500,00');
    expect(contenido).toContain('$ 18.000,50');
    expect(contenido).toContain('Se cargaron 2 servicios.');
    expect(host.querySelectorAll('.card:not(.card--skeleton)')).toHaveLength(2);

    const imagenes = host.querySelectorAll<HTMLImageElement>('.card__media img');
    expect(imagenes).toHaveLength(2);
    expect(imagenes[0]?.getAttribute('src')).toBe('https://example.com/corte.jpg');
    expect(imagenes[0]?.getAttribute('alt')).toBe('Corte de pelo');
    expect(imagenes[0]?.getAttribute('loading')).toBe('lazy');
    expect(imagenes[1]?.getAttribute('src')).toMatch(/^data:image\/svg\+xml/);
  });

  it('muestra el resumen de la sucursal con abejas, puntuación y cantidad de reseñas', async () => {
    const host = await abrirConServicios();
    const resumen = host.querySelector<HTMLElement>('.sucursal-resumen');

    expect(resumen).not.toBeNull();
    expect(resumen?.querySelector('.sucursal-resumen__nombre')?.textContent?.trim()).toBe(
      'Sucursal Flores',
    );
    expect(resumen?.querySelectorAll('.sucursal-resumen__abeja')).toHaveLength(4);
    expect(texto(resumen!)).toContain('4/5');
    expect(texto(resumen!)).toContain('(12 reseñas)');
    expect(resumen?.querySelector('.sucursal-resumen__rating .sr-only')?.textContent).toContain(
      'Puntuación promedio 4/5',
    );
  });

  it('sin reseñas no muestra abejas ni una puntuación ficticia', async () => {
    const host = await abrirConServicios(SERVICIOS, '/sucursal/7/servicios', {
      ...SUCURSAL,
      puntuacion: null,
      cantidadPuntuaciones: 0,
    });
    const resumen = host.querySelector<HTMLElement>('.sucursal-resumen');

    expect(resumen).not.toBeNull();
    expect(resumen?.querySelectorAll('.sucursal-resumen__abeja')).toHaveLength(0);
    expect(texto(resumen!)).toContain('Sin reseñas todavía');
    expect(texto(resumen!)).not.toContain('/5');
  });

  it('formatea 30, 60 y 90 minutos con el criterio de la historia', async () => {
    const host = await abrirConServicios([
      { ...SERVICIOS[0], id: 11, nombre: 'Treinta', duracion: 30 },
      { ...SERVICIOS[0], id: 12, nombre: 'Sesenta', duracion: 60 },
      { ...SERVICIOS[0], id: 13, nombre: 'Noventa', duracion: 90 },
    ]);
    const contenido = texto(host);

    expect(contenido).toContain('30 min');
    expect(contenido).toContain('1 h');
    expect(contenido).toContain('1 h 30 min');
  });

  it('muestra «Precio a consultar» cuando el precio es null y nunca lo muestra como cero', async () => {
    const host = await abrirConServicios([
      { ...SERVICIOS[0], id: 21, nombre: 'Servicio sin precio', precio: null },
    ]);
    const contenido = texto(host);

    expect(contenido).toContain('Precio a consultar');
    expect(contenido).not.toContain('$ 0');
  });

  it('permite expandir y contraer una descripción extensa sin perder la tarjeta', async () => {
    const host = await abrirConServicios([
      { ...SERVICIOS[0], descripcion: DESCRIPCION_LARGA },
    ]);

    const descripcion = host.querySelector<HTMLElement>('.card__descripcion')!;
    const toggle = host.querySelector<HTMLButtonElement>('.card__toggle')!;

    expect(toggle.textContent?.trim()).toContain('Ver más');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(descripcion.classList.contains('card__descripcion--colapsada')).toBe(true);

    toggle.click();
    fixture.detectChanges();

    expect(toggle.textContent?.trim()).toContain('Ver menos');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(descripcion.classList.contains('card__descripcion--colapsada')).toBe(false);
    expect(host.querySelectorAll('.card')).toHaveLength(1);

    toggle.click();
    fixture.detectChanges();

    expect(toggle.textContent?.trim()).toContain('Ver más');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(descripcion.classList.contains('card__descripcion--colapsada')).toBe(true);
  });

  it('conserva completo un nombre largo para que pueda hacer wrap', async () => {
    const nombreLargo =
      'Tratamiento capilar integral con diagnóstico, hidratación profunda y peinado final personalizado';
    const host = await abrirConServicios([
      { ...SERVICIOS[0], id: 31, nombre: nombreLargo },
    ]);

    const nombre = host.querySelector<HTMLElement>('.card__name');
    expect(nombre?.textContent?.trim()).toBe(nombreLargo);
    expect(tarjetas(host)[0]?.getAttribute('aria-label')).toBe(`Seleccionar ${nombreLargo}`);
  });

  it('selecciona un único servicio y sincroniza aria-checked con el estado visual', async () => {
    const host = await abrirConServicios();
    const grupo = host.querySelector<HTMLElement>('.lista');
    let botones = tarjetas(host);

    expect(grupo?.getAttribute('role')).toBe('radiogroup');
    expect(grupo?.getAttribute('aria-labelledby')).toBe('servicios-titulo');
    expect(botones).toHaveLength(2);
    expect(botones[0]?.getAttribute('role')).toBe('radio');
    expect(botones[0]?.getAttribute('aria-checked')).toBe('false');
    expect(botones[1]?.getAttribute('aria-checked')).toBe('false');
    expect(botones[0]?.tagName).toBe('BUTTON');
    expect(botones[0]?.tabIndex).toBe(0);
    expect(botones[1]?.tabIndex).toBe(-1);
    expect(botones[0]?.getAttribute('aria-label')).toBe('Seleccionar Corte de pelo');

    botones[0]?.click();
    fixture.detectChanges();

    botones = tarjetas(host);
    expect(botones[0]?.getAttribute('aria-checked')).toBe('true');
    expect(botones[1]?.getAttribute('aria-checked')).toBe('false');
    expect(botones[0]?.tabIndex).toBe(0);
    expect(botones[1]?.tabIndex).toBe(-1);
    expect(host.querySelectorAll('.card--seleccionada')).toHaveLength(1);
    expect(host.querySelectorAll('.card__check')).toHaveLength(1);
    expect(texto(host)).toContain('Servicio seleccionado:');
    expect(texto(host)).toContain('Corte de pelo');

    botones[1]?.click();
    fixture.detectChanges();

    botones = tarjetas(host);
    expect(botones[0]?.getAttribute('aria-checked')).toBe('false');
    expect(botones[1]?.getAttribute('aria-checked')).toBe('true');
    expect(botones[0]?.tabIndex).toBe(-1);
    expect(botones[1]?.tabIndex).toBe(0);
    expect(host.querySelectorAll('.card--seleccionada')).toHaveLength(1);
    expect(host.querySelectorAll('.card__check')).toHaveLength(1);
    expect(texto(host)).toContain('Color');
  });

  it('actualiza el resumen con nombre, duración y precio al cambiar de servicio', async () => {
    const host = await abrirConServicios();
    const resumen = () => host.querySelector<HTMLElement>('.acciones__resumen')!;

    expect(resumen().getAttribute('role')).toBe('status');
    expect(resumen().getAttribute('aria-live')).toBe('polite');
    expect(texto(resumen())).toContain('Elegí un servicio para continuar.');

    tarjetas(host)[0]?.click();
    fixture.detectChanges();

    expect(texto(resumen())).toContain('Servicio seleccionado:');
    expect(texto(resumen())).toContain('Corte de pelo');
    expect(texto(resumen())).toContain('45 min');
    expect(texto(resumen())).toContain('$ 12.500,00');

    tarjetas(host)[1]?.click();
    fixture.detectChanges();

    expect(texto(resumen())).toContain('Color');
    expect(texto(resumen())).toContain('1 h 30 min');
    expect(texto(resumen())).toContain('$ 18.000,50');
    expect(texto(resumen())).not.toContain('Corte de pelo');
  });

  it('selecciona con Enter y con barra espaciadora', async () => {
    const host = await abrirConServicios();
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
    expect(texto(host.querySelector('.acciones__resumen')!)).toContain('Corte de pelo');

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
    expect(texto(host.querySelector('.acciones__resumen')!)).toContain('Color');
  });

  it('navega con las flechas del grupo radio y acompaña la selección con el foco', async () => {
    const host = await abrirConServicios();
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
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }),
    );
    fixture.detectChanges();

    botones = tarjetas(host);
    expect(botones[0]?.getAttribute('aria-checked')).toBe('true');
    expect(document.activeElement).toBe(botones[0]);

    botones[0]?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }),
    );
    fixture.detectChanges();

    botones = tarjetas(host);
    expect(botones[1]?.getAttribute('aria-checked')).toBe('true');
    expect(document.activeElement).toBe(botones[1]);

    botones[1]?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }),
    );
    fixture.detectChanges();

    expect(tarjetas(host)[0]?.getAttribute('aria-checked')).toBe('true');
  });

  it('mantiene «Siguiente» deshabilitado sin selección y navega al paso 2 con el servicio', async () => {
    const host = await abrirConServicios();
    const botonSiguiente = () => host.querySelector<HTMLButtonElement>('.boton--empleado')!;

    expect(botonSiguiente().textContent?.trim()).toBe('Siguiente');
    expect(botonSiguiente().disabled).toBe(true);
    expect(texto(host)).toContain('Elegí un servicio para continuar.');

    botonSiguiente().click();
    await fixture.whenStable();
    expect(router.url).toBe('/sucursal/7/servicios');

    tarjetas(host)[0]?.click();
    fixture.detectChanges();
    expect(botonSiguiente().disabled).toBe(false);

    botonSiguiente().click();
    await fixture.whenStable();

    expect(router.url).toBe('/sucursal/7/servicios/1/empleados');
  });

  it('bloquea navegaciones duplicadas mientras se procesa el paso 2', async () => {
    const host = await abrirConServicios();

    tarjetas(host)[0]?.click();
    fixture.detectChanges();

    const navegar = vi.spyOn(router, 'navigate').mockReturnValue(Promise.resolve(true));
    const botonSiguiente = host.querySelector<HTMLButtonElement>('.boton--empleado')!;

    botonSiguiente.click();
    botonSiguiente.click();
    fixture.detectChanges();

    expect(navegar).toHaveBeenCalledTimes(1);
    expect(navegar).toHaveBeenCalledWith(['/sucursal', 7, 'servicios', 1, 'empleados']);
    expect(botonSiguiente.disabled).toBe(true);
    expect(botonSiguiente.getAttribute('aria-busy')).toBe('true');
    expect(host.querySelectorAll('.card--seleccionada')).toHaveLength(1);

    navegar.mockRestore();
  });

  it('preselecciona el servicio indicado por URL cuando existe y está disponible', async () => {
    const host = await abrirConServicios(SERVICIOS, '/sucursal/7/servicios?servicioId=2');
    const botones = tarjetas(host);

    expect(botones[0]?.getAttribute('aria-checked')).toBe('false');
    expect(botones[1]?.getAttribute('aria-checked')).toBe('true');
    expect(botones[1]?.tabIndex).toBe(0);
    expect(host.querySelectorAll('.card--seleccionada')).toHaveLength(1);
    expect(host.querySelector('.aviso-preseleccion')).toBeNull();

    const resumen = texto(host.querySelector('.acciones__resumen')!);
    expect(resumen).toContain('Color');
    expect(resumen).toContain('1 h 30 min');
    expect(resumen).toContain('$ 18.000,50');
    expect(host.querySelector<HTMLButtonElement>('.boton--empleado')?.disabled).toBe(false);
  });

  it('si el servicio de la URL no existe, avisa, recarga una vez y no deja selección inválida', async () => {
    await router.navigateByUrl('/sucursal/7/servicios?servicioId=99');
    fixture.detectChanges();

    backend.expectOne((request) => request.url.endsWith('/sucursales/7')).flush(SUCURSAL);
    backend
      .expectOne((request) => request.url.endsWith('/servicios/listar/sucursal/7'))
      .flush(SERVICIOS);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(texto(host)).toContain('Actualizando los servicios disponibles');

    backend
      .expectOne((request) => request.url.endsWith('/servicios/listar/sucursal/7'))
      .flush(SERVICIOS);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto(host)).toContain('ya no está disponible');
    expect(host.querySelectorAll('.aviso-preseleccion')).toHaveLength(1);
    expect(host.querySelectorAll('.card--seleccionada')).toHaveLength(0);
    expect(tarjetas(host).every((boton) => boton.getAttribute('aria-checked') === 'false')).toBe(
      true,
    );
    expect(host.querySelector<HTMLButtonElement>('.boton--empleado')?.disabled).toBe(true);
  });

  it('vuelve a verificar y preselecciona si el servicio reaparece al recargar', async () => {
    await router.navigateByUrl('/sucursal/7/servicios?servicioId=2');
    fixture.detectChanges();

    backend.expectOne((request) => request.url.endsWith('/sucursales/7')).flush(SUCURSAL);
    backend
      .expectOne((request) => request.url.endsWith('/servicios/listar/sucursal/7'))
      .flush([SERVICIOS[0]]);
    fixture.detectChanges();

    expect(texto(fixture.nativeElement)).toContain('Actualizando los servicios disponibles');

    backend
      .expectOne((request) => request.url.endsWith('/servicios/listar/sucursal/7'))
      .flush(SERVICIOS);
    await fixture.whenStable();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const botones = tarjetas(host);
    expect(botones[1]?.getAttribute('aria-checked')).toBe('true');
    expect(texto(host.querySelector('.acciones__resumen')!)).toContain('Color');
    expect(host.querySelector('.aviso-preseleccion')).toBeNull();
    expect(host.querySelector<HTMLButtonElement>('.boton--empleado')?.disabled).toBe(false);
  });

  it('no selecciona automáticamente si el servicioId de la URL no es válido', async () => {
    const host = await abrirConServicios(SERVICIOS, '/sucursal/7/servicios?servicioId=invalido');

    expect(host.querySelectorAll('.card--seleccionada')).toHaveLength(0);
    expect(tarjetas(host).every((boton) => boton.getAttribute('aria-checked') === 'false')).toBe(
      true,
    );
    expect(host.querySelector('.aviso-preseleccion')).toBeNull();
    expect(host.querySelector<HTMLButtonElement>('.boton--empleado')?.disabled).toBe(true);
  });

  it('«Volver al detalle» conserva la sucursal desde la que se inició la reserva', async () => {
    const host = await abrirConServicios();
    const volver = host.querySelector<HTMLAnchorElement>('.volver');

    expect(volver?.textContent?.trim()).toContain('Volver al detalle');
    expect(volver?.getAttribute('href')).toBe('/sucursal/7');
  });

  it('US-SERV-06 · muestra tarjetas skeleton mientras cargan los servicios', async () => {
    await router.navigateByUrl('/sucursal/7/servicios');
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelectorAll('.card--skeleton')).toHaveLength(4);
    expect(host.querySelector('.lista')?.getAttribute('aria-busy')).toBe('true');
    expect(texto(host)).toContain('Cargando servicios');
    expect(host.querySelector('[aria-live="polite"]')).not.toBeNull();

    backend.expectOne((request) => request.url.endsWith('/sucursales/7')).flush(SUCURSAL);
    backend
      .expectOne((request) => request.url.endsWith('/servicios/listar/sucursal/7'))
      .flush(SERVICIOS);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(host.querySelectorAll('.card--skeleton')).toHaveLength(0);
    expect(texto(host)).toContain('Se cargaron 2 servicios');
  });

  it('sin sucursalId muestra el error de contexto y el enlace al Home sin pedir datos', async () => {
    const host = await abrir('/servicios');

    expect(texto(host)).toContain('No pudimos identificar la sucursal');
    const home = host.querySelector<HTMLAnchorElement>('.estado--contexto .boton');
    expect(home?.textContent?.trim()).toBe('Volver al Home');
    expect(home?.getAttribute('href')).toBe('/');
  });

  it('con una sucursal sin servicios muestra el estado vacío y vuelve al detalle', async () => {
    const host = await abrirConServicios([], '/servicios?sucursalId=7');

    expect(texto(host)).toContain('Esta sucursal todavía no tiene servicios disponibles');
    const vacio = host.querySelector('.estado--vacio');
    expect(vacio?.getAttribute('role')).toBe('status');
    expect(vacio?.getAttribute('aria-live')).toBe('polite');
    const detalle = host.querySelector<HTMLAnchorElement>('.estado--vacio .boton');
    expect(detalle?.textContent?.trim()).toBe('Volver al detalle');
    expect(detalle?.getAttribute('href')).toBe('/sucursal/7');
  });

  it('si la cuenta no tiene rol CLIENTE muestra un mensaje específico y no ofrece reintentar', async () => {
    await router.navigateByUrl('/sucursal/7/servicios');
    fixture.detectChanges();

    backend.expectOne((request) => request.url.endsWith('/sucursales/7')).flush(SUCURSAL);
    backend
      .expectOne((request) => request.url.endsWith('/servicios/listar/sucursal/7'))
      .flush({}, { status: 403, statusText: 'Forbidden' });
    await fixture.whenStable();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(texto(host)).toContain('Tu cuenta no tiene el rol Cliente');
    expect(host.querySelector('.estado--error button.boton')).toBeNull();
    const volver = host.querySelector<HTMLAnchorElement>('.estado--error a.boton--ghost');
    expect(volver?.textContent?.trim()).toBe('Volver al detalle');
    expect(volver?.getAttribute('href')).toBe('/sucursal/7');
  });

  it('ante una falla muestra el error inline y el reintento conserva la sucursal', async () => {
    const alerta = vi.spyOn(window, 'alert').mockImplementation(() => {});
    await router.navigateByUrl('/sucursal/7/servicios');
    fixture.detectChanges();

    backend.expectOne((request) => request.url.endsWith('/sucursales/7')).flush(SUCURSAL);
    backend
      .expectOne((request) => request.url.endsWith('/servicios/listar/sucursal/7'))
      .flush({}, { status: 503, statusText: 'Unavailable' });
    await fixture.whenStable();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(texto(host)).toContain('No pudimos cargar los servicios');
    expect(texto(host)).toContain('Sucursal Flores');
    expect(router.url).toBe('/sucursal/7/servicios');
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
    expect(texto(host)).toContain('Reintentando la carga de servicios');

    // El segundo clic no debe disparar otra petición mientras la primera sigue en vuelo.
    const solicitudes = backend.match(
      (request) => request.url.endsWith('/servicios/listar/sucursal/7'),
    );
    expect(solicitudes).toHaveLength(1);
    solicitudes[0].flush(SERVICIOS);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto(host)).toContain('Corte de pelo');
    expect(texto(host)).toContain('Sucursal Flores');
    expect(host.querySelector('.estado--error')).toBeNull();
  });

  it('US-SERV-06 · sin conexión muestra un mensaje específico y permite reintentar', async () => {
    const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

    await router.navigateByUrl('/sucursal/7/servicios');
    fixture.detectChanges();

    backend.expectOne((request) => request.url.endsWith('/sucursales/7')).flush(SUCURSAL);
    backend
      .expectOne((request) => request.url.endsWith('/servicios/listar/sucursal/7'))
      .flush({}, { status: 0, statusText: 'Unknown Error' });
    await fixture.whenStable();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(texto(host)).toContain('Sin conexión a internet');
    expect(texto(host)).toContain('Revisá tu conexión');
    expect(texto(host)).toContain('Sucursal Flores');

    const reintentar = host.querySelector<HTMLButtonElement>('.estado--error button.boton');
    expect(reintentar?.textContent?.trim()).toBe('Reintentar');
    reintentar?.click();
    fixture.detectChanges();
    expect(reintentar?.disabled).toBe(true);

    const solicitud = backend.expectOne((request) =>
      request.url.endsWith('/servicios/listar/sucursal/7'),
    );
    onLine.mockReturnValue(true);
    window.dispatchEvent(new Event('online'));
    fixture.detectChanges();
    expect(texto(host)).toContain('La conexión volvió');

    solicitud.flush(SERVICIOS);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto(host)).toContain('Corte de pelo');
    expect(host.querySelector('.estado--error')).toBeNull();
  });

  it('US-SERV-06 · al perder la conexión conserva los servicios y ofrece reintentar', async () => {
    const host = await abrirConServicios();

    const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    window.dispatchEvent(new Event('offline'));
    fixture.detectChanges();

    const aviso = host.querySelector('.aviso-conexion');
    expect(aviso).not.toBeNull();
    expect(aviso?.getAttribute('role')).toBe('alert');
    expect(aviso?.getAttribute('aria-live')).toBe('assertive');
    expect(texto(host)).toContain('Sin conexión a internet');
    expect(texto(host)).toContain('Corte de pelo');
    expect(aviso?.querySelector('button')?.textContent?.trim()).toBe('Reintentar');

    onLine.mockReturnValue(true);
    window.dispatchEvent(new Event('online'));
    fixture.detectChanges();
    expect(host.querySelector('.aviso-conexion')).toBeNull();
  });

  it('usa el fallback cuando una imagen no se puede cargar', async () => {
    const host = await abrirConServicios([SERVICIOS[0]]);

    const imagen = host.querySelector<HTMLImageElement>('.card__media img')!;
    imagen.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    expect(imagen.getAttribute('src')).toMatch(/^data:image\/svg\+xml/);
  });

  it('US-SERV-04 · restaura la sucursal y el servicio elegidos desde el contexto temporal', async () => {
    sessionStorage.setItem(
      'appointmee.reserva-contexto.v1',
      JSON.stringify({ version: 1, sucursalId: 7, servicioId: 2 }),
    );

    await router.navigateByUrl('/sucursal/7/servicios');
    fixture.detectChanges();

    backend.expectOne((request) => request.url.endsWith('/sucursales/7')).flush(SUCURSAL);
    backend
      .expectOne((request) => request.url.endsWith('/servicios/listar/sucursal/7'))
      .flush(SERVICIOS);
    await fixture.whenStable();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const seleccionado = host.querySelector('.card--seleccionado');
    expect(seleccionado).not.toBeNull();
    expect(seleccionado?.textContent).toContain('Color');
    expect(JSON.parse(sessionStorage.getItem('appointmee.reserva-contexto.v1') ?? 'null')).toEqual({
      version: 1,
      sucursalId: 7,
      servicioId: 2,
    });
  });

  it('US-SERV-04 · al elegir un servicio guarda el contexto y avanza al paso de profesional', async () => {
    await router.navigateByUrl('/sucursal/7/servicios');
    fixture.detectChanges();

    backend.expectOne((request) => request.url.endsWith('/sucursales/7')).flush(SUCURSAL);
    backend
      .expectOne((request) => request.url.endsWith('/servicios/listar/sucursal/7'))
      .flush(SERVICIOS);
    await fixture.whenStable();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const elegir = Array.from(host.querySelectorAll<HTMLAnchorElement>('a')).find(
      (ancla) => (ancla.textContent ?? '').trim() === 'Elegir turno',
    );
    expect(elegir).toBeDefined();

    elegir?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(router.url).toBe('/sucursal/7/servicios/1/turnos');
    expect(JSON.parse(sessionStorage.getItem('appointmee.reserva-contexto.v1') ?? 'null')).toEqual({
      version: 1,
      sucursalId: 7,
      servicioId: 1,
    });
  });
});
