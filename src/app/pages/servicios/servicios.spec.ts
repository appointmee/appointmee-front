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

describe('US-SERV-01 · Elegir servicio', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<TestShell>>;
  let router: Router;
  let backend: HttpTestingController;

  beforeEach(async () => {
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [TestShell],
      providers: [
        provideRouter([
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

  function texto(host: HTMLElement): string {
    return (host.textContent ?? '').replace(/\u00a0/g, ' ');
  }

  it('muestra la sucursal, el paso 1 y los servicios con imagen, duración y precio', async () => {
    await router.navigateByUrl('/sucursal/7/servicios');
    fixture.detectChanges();

    backend.expectOne((request) => request.url.endsWith('/sucursales/7')).flush(SUCURSAL);
    backend
      .expectOne((request) => request.url.endsWith('/servicios/listar/sucursal/7'))
      .flush(SERVICIOS);
    await fixture.whenStable();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const contenido = texto(host);

    expect(contenido).toContain('Sucursal Flores');
    expect(contenido).toContain('Paso 1 de 3 — Servicio');
    expect(contenido).toContain('Corte de pelo');
    expect(contenido).toContain('45 min');
    expect(contenido).toContain('$ 12.500');
    expect(host.querySelectorAll('.card:not(.card--skeleton)')).toHaveLength(2);

    const imagenes = host.querySelectorAll<HTMLImageElement>('.card__media img');
    expect(imagenes).toHaveLength(2);
    expect(imagenes[0]?.getAttribute('src')).toBe('https://example.com/corte.jpg');
    expect(imagenes[0]?.getAttribute('alt')).toBe('Corte de pelo');
    expect(imagenes[1]?.getAttribute('src')).toMatch(/^data:image\/svg\+xml/);
  });

  it('US-SERV-06 · muestra tarjetas skeleton mientras cargan los servicios', async () => {
    await router.navigateByUrl('/sucursal/7/servicios');
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelectorAll('.card--skeleton')).toHaveLength(6);
    expect(host.querySelector('.grid')?.getAttribute('aria-busy')).toBe('true');
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
    await router.navigateByUrl('/servicios?sucursalId=7');
    fixture.detectChanges();

    backend.expectOne((request) => request.url.endsWith('/sucursales/7')).flush(SUCURSAL);
    backend
      .expectOne((request) => request.url.endsWith('/servicios/listar/sucursal/7'))
      .flush([]);
    await fixture.whenStable();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
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

    const reintentar = host.querySelector<HTMLButtonElement>('.estado--error .boton');
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
    await router.navigateByUrl('/sucursal/7/servicios');
    fixture.detectChanges();

    backend.expectOne((request) => request.url.endsWith('/sucursales/7')).flush(SUCURSAL);
    backend
      .expectOne((request) => request.url.endsWith('/servicios/listar/sucursal/7'))
      .flush(SERVICIOS);
    await fixture.whenStable();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
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
    await router.navigateByUrl('/sucursal/7/servicios');
    fixture.detectChanges();

    backend.expectOne((request) => request.url.endsWith('/sucursales/7')).flush(SUCURSAL);
    backend
      .expectOne((request) => request.url.endsWith('/servicios/listar/sucursal/7'))
      .flush([SERVICIOS[0]]);
    await fixture.whenStable();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
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
