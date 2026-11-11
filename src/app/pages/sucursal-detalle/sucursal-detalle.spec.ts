import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, RouterOutlet, provideRouter } from '@angular/router';

import { authService } from '../../services/auth-service';
import { destinoDespuesDelLogin } from '../../guards/login-destination';
import { SucursalDetalleDTO } from '../../models/sucursal';
import { SucursalDetalle } from './sucursal-detalle';

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
  telefono: '11 5555-1234',
  descripcion: 'Una sucursal de barrio con atención personalizada.',
  fechaCreacion: '2024-01-01',
  categoria: 'CAFE',
  horaApertura: '09:00',
  horaCierre: '18:00',
  diasApertura: ['MONDAY', 'TUESDAY', 'WEDNESDAY'],
  puntuacion: 4,
  cantidadPuntuaciones: 12,
  fotoPerfil: null,
};

describe('US-SUC-05 · Iniciar la reserva desde el detalle', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<TestShell>>;
  let router: Router;
  let backend: HttpTestingController;

  const auth = {
    autenticado: vi.fn(),
    tieneAlgunRol: vi.fn(),
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    auth.autenticado.mockReturnValue(false);
    auth.tieneAlgunRol.mockReturnValue(false);

    await TestBed.configureTestingModule({
      imports: [TestShell],
      providers: [
        provideRouter([
          { path: 'sucursal/:sucursalId/servicios', component: Dummy },
          { path: 'sucursal/:id', component: SucursalDetalle },
          { path: 'login', component: Dummy },
          { path: 'sucursales', component: Dummy },
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
  });

  async function abrir(url: string): Promise<HTMLElement> {
    await router.navigateByUrl(url);
    fixture.detectChanges();

    backend
      .expectOne((request) => request.url.endsWith('/sucursales/7'))
      .flush(SUCURSAL);

    fixture.detectChanges();
    backend
      .expectOne((request) => request.url.endsWith('/sucursales/7/resenias'))
      .flush([]);
    backend
      .expectOne((request) => request.url.endsWith('/sucursales/7/elegir-empleado'))
      .flush([]);

    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  async function abrirConSucursal(
    sucursal: SucursalDetalleDTO,
  ): Promise<HTMLElement> {
    await router.navigateByUrl('/sucursal/7');
    fixture.detectChanges();

    backend
      .expectOne((request) => request.url.endsWith('/sucursales/7'))
      .flush(sucursal);

    fixture.detectChanges();
    backend
      .expectOne((request) => request.url.endsWith('/sucursales/7/resenias'))
      .flush([]);
    backend
      .expectOne((request) => request.url.endsWith('/sucursales/7/elegir-empleado'))
      .flush([]);

    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function texto(host: HTMLElement): string {
    return (host.textContent ?? '').replace(/\u00a0/g, ' ');
  }

  function botonReserva(host: HTMLElement): HTMLButtonElement {
    const boton = host.querySelector<HTMLButtonElement>('.panel--reserva button.btn--primary');
    expect(boton).not.toBeNull();
    return boton!;
  }

  it('muestra miniaturas accesibles y cambia la principal al seleccionarlas', async () => {
    const host = await abrirConSucursal({
      ...SUCURSAL,
      imagenes: ['https://imagenes.example/sucursal-1.jpg', 'https://imagenes.example/sucursal-2.jpg'],
    });
    const principal = host.querySelector<HTMLImageElement>('.detalle__hero-img');
    const miniaturas = host.querySelectorAll<HTMLButtonElement>('.detalle__miniatura');

    expect(principal?.getAttribute('src')).toBe('https://imagenes.example/sucursal-1.jpg');
    expect(principal?.getAttribute('alt')).toBe('Foto 1 de Sucursal Flores');
    expect(miniaturas).toHaveLength(2);
    expect(miniaturas[0].getAttribute('aria-pressed')).toBe('true');
    expect(miniaturas[1].getAttribute('aria-pressed')).toBe('false');
    expect(miniaturas[1].getAttribute('aria-label')).toContain('Mostrar Foto 2 de Sucursal Flores');
    expect(miniaturas[1].querySelector('img')?.getAttribute('loading')).toBe('lazy');

    miniaturas[1].click();
    fixture.detectChanges();

    expect(principal?.getAttribute('src')).toBe('https://imagenes.example/sucursal-2.jpg');
    expect(miniaturas[0].getAttribute('aria-pressed')).toBe('false');
    expect(miniaturas[1].getAttribute('aria-pressed')).toBe('true');
  });

  it('usa la descripción de cada imagen cuando el DTO la incluye', async () => {
    const host = await abrirConSucursal({
      ...SUCURSAL,
      imagenes: [
        {
          url: 'https://imagenes.example/fachada.jpg',
          descripcion: 'Fachada principal con entrada de vidrio',
        },
        'https://imagenes.example/segunda.jpg',
      ],
    });
    const principal = host.querySelector<HTMLImageElement>('.detalle__hero-img');
    const miniaturas = host.querySelectorAll<HTMLButtonElement>('.detalle__miniatura');

    expect(miniaturas[0].querySelector('img')?.getAttribute('alt')).toBe(
      'Fachada principal con entrada de vidrio',
    );
    miniaturas[0].click();
    fixture.detectChanges();
    expect(principal?.getAttribute('alt')).toBe('Fachada principal con entrada de vidrio');
    expect(miniaturas[0].getAttribute('aria-label')).toContain(
      'Fachada principal con entrada de vidrio',
    );
  });

  it('permite recorrer las miniaturas con flechas y mueve el foco', async () => {
    const host = await abrirConSucursal({
      ...SUCURSAL,
      imagenes: ['https://imagenes.example/sucursal-1.jpg', 'https://imagenes.example/sucursal-2.jpg'],
    });
    const miniaturas = host.querySelectorAll<HTMLButtonElement>('.detalle__miniatura');
    miniaturas[0].focus();
    miniaturas[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    fixture.detectChanges();

    expect(host.querySelector<HTMLImageElement>('.detalle__hero-img')?.getAttribute('src')).toBe(
      'https://imagenes.example/sucursal-2.jpg',
    );
    expect(document.activeElement).toBe(miniaturas[1]);
  });

  it('usa placeholder si la foto de perfil también falla', async () => {
    const host = await abrirConSucursal({
      ...SUCURSAL,
      fotoPerfil: 'https://imagenes.example/rota.jpg',
      imagenes: [],
    });
    const principal = host.querySelector<HTMLImageElement>('.detalle__hero-img');
    principal?.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    expect(principal?.getAttribute('src')).toContain('data:image/svg+xml');
    expect(principal?.getAttribute('alt')).toBe('No hay imágenes disponibles para Sucursal Flores');
  });

  it('muestra el CTA primario, el texto de apoyo y un nombre accesible', async () => {
    const host = await abrir('/sucursal/7');
    const boton = botonReserva(host);

    expect(boton.textContent).toContain('Reservar turno');
    expect(boton.classList.contains('btn--block')).toBe(true);
    expect(boton.getAttribute('aria-label')).toBe('Reservar turno en Sucursal Flores');
    expect(boton.getAttribute('aria-describedby')).toBe('reserva-ayuda');
    expect(texto(host)).toContain('Elegí el servicio, el profesional y el horario');

    const ayuda = host.querySelector<HTMLElement>('#reserva-ayuda');
    expect(ayuda?.textContent).toBe('Elegí el servicio, el profesional y el horario.');

    const sticky = host.querySelector<HTMLButtonElement>('.detalle__cta-mobile button');
    expect(sticky).not.toBeNull();
    expect(sticky?.getAttribute('aria-label')).toBe('Reservar turno en Sucursal Flores');
  });

  it('con sesión CLIENTE navega a elegir servicio con el sucursalId correcto', async () => {
    auth.autenticado.mockReturnValue(true);
    auth.tieneAlgunRol.mockReturnValue(true);

    const host = await abrir('/sucursal/7');
    botonReserva(host).click();
    await fixture.whenStable();

    expect(router.url).toBe('/sucursal/7/servicios');
  });

  it('sin sesión va al login con returnTo a la elección de servicio de esa sucursal', async () => {
    const host = await abrir('/sucursal/7');
    botonReserva(host).click();
    await fixture.whenStable();

    expect(router.url.split('?')[0]).toBe('/login');
    expect(router.parseUrl(router.url).queryParams['returnTo']).toBe('/sucursal/7/servicios');

    // El login acepta ese returnTo y vuelve a la elección sin perder la sucursal.
    const destino = destinoDespuesDelLogin(router, '/sucursal/7/servicios');
    expect(router.serializeUrl(destino)).toBe('/sucursal/7/servicios');
  });

  it('con sesión sin rol CLIENTE muestra un aviso específico y no navega', async () => {
    auth.autenticado.mockReturnValue(true);
    auth.tieneAlgunRol.mockReturnValue(false);

    const host = await abrir('/sucursal/7');
    const navegar = vi.spyOn(router, 'navigate');
    const navegarPorUrl = vi.spyOn(router, 'navigateByUrl');

    botonReserva(host).click();
    fixture.detectChanges();

    expect(texto(host)).toContain('Tu cuenta no tiene el rol Cliente');
    expect(host.querySelector('.panel__aviso')?.getAttribute('role')).toBe('alert');
    expect(host.querySelector('.detalle__cta-aviso')?.textContent).toContain('rol Cliente');
    expect(navegar).not.toHaveBeenCalled();
    expect(navegarPorUrl).not.toHaveBeenCalled();
    expect(router.url).toBe('/sucursal/7');
  });

  it('bloquea un segundo clic mientras la navegación está en curso', async () => {
    auth.autenticado.mockReturnValue(true);
    auth.tieneAlgunRol.mockReturnValue(true);

    const host = await abrir('/sucursal/7');
    const boton = botonReserva(host);
    const pendiente = new Promise<boolean>(() => undefined);
    const navegarPorUrl = vi.spyOn(router, 'navigateByUrl').mockReturnValue(pendiente);

    boton.click();
    fixture.detectChanges();

    expect(boton.disabled).toBe(true);
    expect(boton.getAttribute('aria-busy')).toBe('true');
    expect(boton.textContent).toContain('Abriendo');

    boton.click();
    fixture.detectChanges();

    expect(navegarPorUrl).toHaveBeenCalledTimes(1);
  });

  it('si la sucursal no existe muestra el estado de no encontrada con salida al listado', async () => {
    await router.navigateByUrl('/sucursal/999');
    fixture.detectChanges();

    backend
      .expectOne((request) => request.url.endsWith('/sucursales/999'))
      .flush({}, { status: 404, statusText: 'Not Found' });

    await fixture.whenStable();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(texto(host)).toContain('No encontramos esta sucursal');
    expect(host.querySelector<HTMLAnchorElement>('a[href="/sucursales"]')?.textContent).toContain(
      'Volver a sucursales',
    );
  });
});
