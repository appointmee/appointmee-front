import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, RouterOutlet, provideRouter } from '@angular/router';

import { EmpleadosSucursal } from './empleados-sucursal';
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

const RUTA_BASE = '/mis-sucursales/7/empleados';

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

/**
 * Estilos que Angular registra en el documento al renderizar el componente.
 * Se usan para verificar reglas de CSS que jsdom no aplica (alto máximo del
 * listado, divisores amarillos y compactación de la auto-incorporación).
 */
function estilosRegistrados(): string {
  return Array.from(document.querySelectorAll('style'))
    .map((style) => style.textContent ?? '')
    .join('\n');
}

describe('SCRUM-268 · Empleados de la sucursal', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<TestShell>>;
  let router: Router;
  let backend: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestShell],
      providers: [
        provideRouter([
          {
            path: 'mis-sucursales/:sucursalId/empleados',
            component: EmpleadosSucursal,
          },
          { path: 'mis-sucursales', component: Dummy },
          { path: '', component: Dummy },
        ]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: authService,
          useValue: {
            perfil: signal({ id: 99, email: 'empleador@ejemplo.com', roles: ['EMPLEADOR'] }),
          },
        },
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

  function filas(host: HTMLElement): HTMLElement[] {
    return Array.from(host.querySelectorAll<HTMLElement>('.lista .empleado'));
  }

  async function abrir(url = RUTA_BASE): Promise<HTMLElement> {
    await router.navigateByUrl(url);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function responderListado(
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

  it('muestra el estado de carga con cinco filas skeleton mientras cargan los empleados', async () => {
    const host = await abrir();

    const scroll = host.querySelector<HTMLElement>('.empleados__scroll');
    expect(scroll?.getAttribute('aria-busy')).toBe('true');
    expect(texto(host)).toContain('Cargando empleados');
    expect(host.querySelectorAll('.empleado--skeleton').length).toBe(5);

    responderListado();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('muestra todos los datos de UsuarioResponseDTO en cada fila', async () => {
    const host = await abrir();
    responderListado();
    await fixture.whenStable();
    fixture.detectChanges();

    const contenido = texto(host);
    expect(contenido).toContain('Ana');
    expect(contenido).toContain('Gómez');
    expect(contenido).toContain('ana@ejemplo.com');
    expect(contenido).toContain('ID 10');
    expect(contenido).toContain('bruno@ejemplo.com');
    expect(contenido).toContain('ID 11');

    const foto = host.querySelector<HTMLImageElement>('.empleado__foto');
    expect(foto?.getAttribute('src')).toBe('https://example.com/ana.jpg');
  });

  it('muestra la puntuación promedio con número y abejas', async () => {
    const host = await abrir();
    responderListado();
    await fixture.whenStable();
    fixture.detectChanges();

    const primera = filas(host)[0];
    expect(primera.querySelector('.empleado__puntuacion')?.textContent?.trim()).toBe('4/5');
    expect(primera.querySelectorAll('.empleado__abejas .abeja').length).toBe(5);
    expect(primera.querySelectorAll('.empleado__abejas .abeja--vacia').length).toBe(1);
    expect(primera.querySelector('.empleado__resenias')?.textContent?.trim()).toBe('12 reseñas');
  });

  it('combina ambos endpoints por identificador sin duplicar empleados', async () => {
    const host = await abrir();
    responderListado(
      USUARIOS,
      [
        ...PUNTUACIONES,
        // El mismo empleado repetido no debe generar una fila extra.
        { ...PUNTUACIONES[0] },
      ],
    );
    await fixture.whenStable();
    fixture.detectChanges();

    const lista = filas(host);
    expect(lista.length).toBe(2);

    // Cada fila conserva su propia puntuación y no la de otro empleado.
    expect(lista[0].querySelector('.empleado__puntuacion')?.textContent?.trim()).toBe('4/5');
    expect(lista[1].querySelector('.empleado__sin-puntuacion')?.textContent?.trim()).toBe(
      'Sin puntuaciones',
    );
  });

  it('mantiene el listado visible cuando falla la carga de las puntuaciones', async () => {
    const host = await abrir();
    backend
      .expectOne((request) => request.url.endsWith('/sucursales/7/empleados'))
      .flush(USUARIOS);
    backend
      .expectOne((request) => request.url.endsWith('/sucursales/7/elegir-empleado'))
      .flush([], { status: 500, statusText: 'Error' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(filas(host).length).toBe(2);
    expect(texto(host)).toContain('No pudimos cargar la puntuación promedio');
  });

  it('muestra el estado vacío cuando la sucursal no tiene empleados', async () => {
    const host = await abrir();
    responderListado([], []);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto(host)).toContain('Esta sucursal todavía no tiene empleados');
    expect(filas(host).length).toBe(0);
  });

  it('muestra el error inline con reintento cuando falla la carga del listado', async () => {
    const host = await abrir();
    backend
      .expectOne((request) => request.url.endsWith('/sucursales/7/empleados'))
      .flush([], { status: 500, statusText: 'Error' });
    backend
      .expectOne((request) => request.url.endsWith('/sucursales/7/elegir-empleado'))
      .flush([]);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto(host)).toContain('No pudimos cargar los empleados');
    expect(host.querySelector('.estado--error')).toBeTruthy();

    const reintentar = Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find((boton) =>
      boton.textContent?.includes('Reintentar'),
    );
    reintentar?.click();
    fixture.detectChanges();

    // El reintento vuelve a pedir los dos endpoints.
    backend
      .expectOne((request) => request.url.endsWith('/sucursales/7/empleados'))
      .flush(USUARIOS);
    backend
      .expectOne((request) => request.url.endsWith('/sucursales/7/elegir-empleado'))
      .flush(PUNTUACIONES);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(filas(host).length).toBe(2);
  });

  it('confunde el scroll con el listado y deja la auto-incorporación fuera', async () => {
    const host = await abrir();
    responderListado();
    await fixture.whenStable();
    fixture.detectChanges();

    const scroll = host.querySelector<HTMLElement>('.empleados__scroll');
    expect(scroll).toBeTruthy();
    expect(scroll?.getAttribute('role')).toBe('region');
    expect(scroll?.getAttribute('tabindex')).toBe('0');
    expect(scroll?.querySelectorAll('.empleado').length).toBe(2);

    const auto = host.querySelector<HTMLElement>('.panel--auto');
    expect(auto).toBeTruthy();
    expect(scroll?.contains(auto)).toBe(false);

    // El panel de auto-incorporación va después del listado.
    const paneles = Array.from(host.querySelectorAll<HTMLElement>('.panel'));
    expect(paneles.indexOf(auto as HTMLElement)).toBe(paneles.length - 1);
  });

  it('limita el listado a cinco empleados simultáneos con scroll propio', async () => {
    await abrir();
    responderListado();
    await fixture.whenStable();
    fixture.detectChanges();

    const css = estilosRegistrados();

    expect(css).toMatch(/--fila-alto:\s*116px/);
    expect(css).toMatch(/max-height:\s*calc\(5\s*\*\s*var\(--fila-alto\)\)/);
    expect(css).toMatch(/overflow-y:\s*auto/);
  });

  it('separa las filas con una línea divisoria amarilla a lo ancho completo', async () => {
    await abrir();
    responderListado();
    await fixture.whenStable();
    fixture.detectChanges();

    const css = estilosRegistrados();

    expect(css).toMatch(/\.empleado[^{]*:not\(:last-child\)[^{]*::after/);
    expect(css).toMatch(/background:\s*var\(--accent\)/);
    expect(css).toMatch(/left:\s*0/);
    expect(css).toMatch(/right:\s*0/);
  });

  it('reduce las dimensiones del bloque de auto-incorporación', async () => {
    await abrir();
    responderListado();
    await fixture.whenStable();
    fixture.detectChanges();

    const css = estilosRegistrados();

    expect(css).toMatch(/\.panel--auto[^{]*\{[^}]*padding:\s*16px 18px/);
    expect(css).toMatch(/\.auto__boton[^{]*\{[^}]*min-height:\s*36px/);
  });

  it('mantiene la auto-incorporación y actualiza el estado al agregarse', async () => {
    const host = await abrir();
    responderListado();
    await fixture.whenStable();
    fixture.detectChanges();

    const boton = Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find((item) =>
      item.textContent?.includes('Agregarme como empleado'),
    );
    expect(boton).toBeTruthy();
    boton?.click();
    fixture.detectChanges();

    backend
      .expectOne((request) => request.url.endsWith('/sucursales/7/convertirme-empleado'))
      .flush('Ahora sos empleado de la sucursal');
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto(host)).toContain('Ya formás parte del equipo de esta sucursal');

    // Tras incorporarse, el listado se vuelve a pedir para mostrar al nuevo empleado.
    backend
      .expectOne((request) => request.url.endsWith('/sucursales/7/empleados'))
      .flush([...USUARIOS, { id: 99, nombre: 'Empleador', apellido: 'Uno', email: 'empleador@ejemplo.com', urlFotoPerfil: null }]);
    backend
      .expectOne((request) => request.url.endsWith('/sucursales/7/elegir-empleado'))
      .flush(PUNTUACIONES);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(filas(host).length).toBe(3);
  });

  it('no permite seleccionar ni abrir el detalle de un empleado', async () => {
    const host = await abrir();
    responderListado();
    await fixture.whenStable();
    fixture.detectChanges();

    const scroll = host.querySelector<HTMLElement>('.empleados__scroll');
    expect(scroll?.querySelectorAll('a').length).toBe(0);
    expect(scroll?.querySelectorAll('button').length).toBe(0);
    expect(scroll?.querySelectorAll('.empleado__enlace').length).toBe(0);
  });

  it('no repite el texto de la puntuación porque ya se ve en las abejas y el número', async () => {
    const host = await abrir();
    responderListado();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto(host)).not.toContain('Puntuación promedio');
  });
});
