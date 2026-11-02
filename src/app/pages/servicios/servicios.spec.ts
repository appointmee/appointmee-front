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
    await TestBed.configureTestingModule({
      imports: [TestShell],
      providers: [
        provideRouter([
          { path: 'sucursal/:sucursalId/servicios', component: Servicios },
          { path: 'servicios', component: Servicios },
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

    const reintentar = host.querySelector<HTMLButtonElement>('.estado--error .boton');
    expect(reintentar?.textContent?.trim()).toBe('Reintentar');
    reintentar?.click();
    fixture.detectChanges();
    expect(reintentar?.disabled).toBe(true);
    expect(reintentar?.textContent).toContain('Reintentando');

    backend
      .expectOne((request) => request.url.endsWith('/servicios/listar/sucursal/7'))
      .flush(SERVICIOS);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto(host)).toContain('Corte de pelo');
    expect(texto(host)).toContain('Sucursal Flores');
    expect(host.querySelector('.estado--error')).toBeNull();
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
});
