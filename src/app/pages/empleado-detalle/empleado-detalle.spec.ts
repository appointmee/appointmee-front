import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, RouterOutlet, provideRouter } from '@angular/router';

import { EmpleadoDetalle } from './empleado-detalle';

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

const RUTA_BASE = '/mis-sucursales/7/empleado/10';

const USUARIOS = [
  {
    id: 10,
    nombre: 'Ana',
    apellido: 'Gómez',
    email: 'ana@ejemplo.com',
    urlFotoPerfil: 'https://example.com/ana.jpg',
  },
  {
    id: 11,
    nombre: 'Bruno',
    apellido: 'Díaz',
    email: 'bruno@ejemplo.com',
    urlFotoPerfil: null,
  },
];

const PUNTUACIONES = [
  {
    id: 10,
    nombre: 'Ana',
    apellido: 'Gómez',
    urlFotoPerfil: 'https://example.com/ana.jpg',
    puntuacion: 3.5,
    cantidadPuntuaciones: 8,
  },
];

describe('SCRUM-268 · Detalle del empleado de la sucursal', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<TestShell>>;
  let router: Router;
  let backend: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestShell],
      providers: [
        provideRouter([
          {
            path: 'mis-sucursales/:sucursalId/empleado/:empleadoId',
            component: EmpleadoDetalle,
          },
          { path: 'mis-sucursales/:sucursalId/empleados', component: Dummy },
          { path: 'mis-sucursales', component: Dummy },
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

  function texto(host: HTMLElement): string {
    return (host.textContent ?? '').replace(/\u00a0/g, ' ');
  }

  async function abrir(url = RUTA_BASE): Promise<HTMLElement> {
    await router.navigateByUrl(url);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function responder(
    usuarios: readonly Record<string, unknown>[] = USUARIOS,
    puntuaciones: readonly Record<string, unknown>[] = PUNTUACIONES,
  ): void {
    backend
      .expectOne((request) => request.url.endsWith('/sucursales/7/empleados'))
      .flush(usuarios);
    backend
      .expectOne((request) => request.url.endsWith('/sucursales/7/elegir-empleado'))
      .flush(puntuaciones);
  }

  it('muestra los datos del empleado y su puntuación promedio', async () => {
    const host = await abrir();
    responder();
    await fixture.whenStable();
    fixture.detectChanges();

    const contenido = texto(host);
    expect(contenido).toContain('Ana');
    expect(contenido).toContain('Gómez');
    expect(contenido).toContain('ana@ejemplo.com');
    expect(contenido).toContain('ID 10');
    expect(contenido).toContain('3,5/5');
    expect(contenido).toContain('8 reseñas');
    expect(host.querySelectorAll('.abeja').length).toBe(5);
    expect(host.querySelectorAll('.abeja--vacia').length).toBe(1);
  });

  it('muestra el estado de carga mientras consulta los datos', async () => {
    const host = await abrir();

    expect(host.querySelector('.panel')?.getAttribute('aria-busy')).toBe('true');
    expect(texto(host)).toContain('Cargando empleado');

    responder();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('muestra el error inline con reintento cuando la carga falla', async () => {
    const host = await abrir();
    backend
      .expectOne((request) => request.url.endsWith('/sucursales/7/empleados'))
      .flush([], { status: 500, statusText: 'Error' });
    backend
      .expectOne((request) => request.url.endsWith('/sucursales/7/elegir-empleado'))
      .flush([]);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto(host)).toContain('No pudimos cargar el detalle del empleado');
    expect(host.querySelector('.estado--error')).toBeTruthy();

    const reintentar = Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find((boton) =>
      boton.textContent?.includes('Reintentar'),
    );
    reintentar?.click();
    fixture.detectChanges();

    responder();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto(host)).toContain('Ana Gómez');
  });

  it('informa cuando el empleado ya no pertenece a la sucursal', async () => {
    const host = await abrir();
    responder([USUARIOS[1]]);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto(host)).toContain('Este empleado ya no forma parte de la sucursal');
  });

  it('ofrece volver al listado de empleados de la sucursal', async () => {
    const host = await abrir();
    responder();
    await fixture.whenStable();
    fixture.detectChanges();

    const volver = host.querySelector<HTMLAnchorElement>('.volver-gestor');
    expect(volver?.getAttribute('href')).toContain('/mis-sucursales/7/empleados');
  });
});
