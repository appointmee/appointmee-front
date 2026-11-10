import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, RouterOutlet, provideRouter } from '@angular/router';

import { authService } from '../../services/auth-service';
import { SucursalDetalle } from './sucursal-detalle';
import { ReporteError } from '../error/reporte-error';

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
    sessionStorage.clear();

    await TestBed.configureTestingModule({
      imports: [TestShell],
      providers: [
        provideRouter([
          { path: 'sucursal/:sucursalId/servicios', component: Dummy },
          { path: 'sucursal/:sucursalId/servicios/:servicioId/turnos', component: Dummy },
          { path: 'sucursal/:id', component: SucursalDetalle },
          { path: 'login', component: Dummy },
          { path: 'sucursales', component: Dummy },
          { path: '', component: Dummy },
        ]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: authService, useValue: auth },
        { provide: ReporteError, useValue: { registrar: vi.fn() } },
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
  });

  async function abrir(url: string): Promise<HTMLElement> {
    await router.navigateByUrl(url);
    fixture.detectChanges();

    backend
      .expectOne((request) => request.url.endsWith('/sucursales/7'))
      .flush(SUCURSAL);

    await fixture.whenStable();
    fixture.detectChanges();
    for (const request of backend.match(request => /\/(resenias|elegir-empleado)$/.test(request.url))) request.flush([]);
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

  it('sin sesión permite abrir los servicios sin pasar por el login', async () => {
    const host = await abrir('/sucursal/7');
    botonReserva(host).click();
    await fixture.whenStable();
    expect(router.url).toBe('/sucursal/7/servicios');
  });

  it('permite consultar servicios con otros roles; el rol se exige al elegir un turno', async () => {
    auth.autenticado.mockReturnValue(true);
    auth.tieneAlgunRol.mockReturnValue(false);
    const host = await abrir('/sucursal/7');
    botonReserva(host).click();
    await fixture.whenStable();
    expect(router.url).toBe('/sucursal/7/servicios');
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

  it('US-SERV-04 · el botón Reservar turno retoma la elección previa de servicio', async () => {
    sessionStorage.setItem(
      'appointmee.reserva-contexto.v1',
      JSON.stringify({ version: 1, sucursalId: 7, servicioId: 3 }),
    );

    const host = await abrir('/sucursal/7');
    botonReserva(host).click();
    await fixture.whenStable();

    expect(router.url).toBe('/sucursal/7/servicios/3/turnos');
    expect(JSON.parse(sessionStorage.getItem('appointmee.reserva-contexto.v1') ?? 'null')).toEqual({
      version: 1,
      sucursalId: 7,
      servicioId: 3,
    });
  });
});
