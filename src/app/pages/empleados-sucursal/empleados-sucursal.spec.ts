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

  it('muestra los datos visibles de cada empleado sin exponer su identificador', async () => {
    const host = await abrir();
    responderListado();
    await fixture.whenStable();
    fixture.detectChanges();

    const contenido = texto(host);
    expect(contenido).toContain('Ana');
    expect(contenido).toContain('Gómez');
    expect(contenido).toContain('ana@ejemplo.com');
    expect(contenido).toContain('bruno@ejemplo.com');
    expect(host.querySelector('.panel__contador')?.textContent?.trim()).toBe('2 Profesionales');

    // El identificador interno no se muestra en el listado.
    expect(contenido).not.toContain('ID 10');
    expect(contenido).not.toContain('ID 11');
    expect(host.querySelectorAll('.empleado__id').length).toBe(0);

    const foto = host.querySelector<HTMLImageElement>('.empleado__foto');
    expect(foto?.getAttribute('src')).toBe('https://example.com/ana.jpg');
  });

  it('muestra la puntuación con abejas y conserva una etiqueta accesible', async () => {
    const host = await abrir();
    responderListado();
    await fixture.whenStable();
    fixture.detectChanges();

    const primera = filas(host)[0];
    expect(primera.querySelector('.empleado__puntuacion')).toBeNull();
    expect(primera.querySelectorAll('.empleado__abejas .abeja').length).toBe(5);
    expect(primera.querySelectorAll('.empleado__abejas .abeja--vacia').length).toBe(1);
    expect(primera.querySelector('.empleado__abejas')?.getAttribute('aria-label')).toBe(
      'Puntuación 4/5',
    );
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
    expect(lista[0].querySelector('.empleado__abejas')?.getAttribute('aria-label')).toBe(
      'Puntuación 4/5',
    );
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

  it('mantiene el botón de auto-incorporación junto al regreso y fuera del scroll', async () => {
    const host = await abrir();
    responderListado();
    await fixture.whenStable();
    fixture.detectChanges();

    const scroll = host.querySelector<HTMLElement>('.empleados__scroll');
    expect(scroll).toBeTruthy();
    expect(scroll?.getAttribute('role')).toBe('region');
    expect(scroll?.getAttribute('tabindex')).toBe('0');
    expect(scroll?.querySelectorAll('.empleado').length).toBe(2);

    const boton = host.querySelector<HTMLElement>('.pagina__acciones .auto__boton');
    expect(boton).toBeTruthy();
    expect(scroll?.contains(boton)).toBe(false);
    expect(boton?.parentElement?.querySelector('.volver-gestor')).toBeTruthy();
  });

  it('limita el listado a cinco empleados simultáneos con scroll propio', async () => {
    await abrir();
    responderListado();
    await fixture.whenStable();
    fixture.detectChanges();

    const css = estilosRegistrados();

    expect(css).toMatch(/--fila-alto:\s*140px/);
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

  it('muestra el listado con un borde discreto', async () => {
    await abrir();
    responderListado();
    await fixture.whenStable();
    fixture.detectChanges();

    const css = estilosRegistrados();

    expect(css).toMatch(/\.panel[^{]*\{[^}]*border:\s*1px solid var\(--line\)/);
    expect(css).toMatch(/\.panel[^{]*\{[^}]*border-radius:\s*var\(--radius-lg\)/);
    expect(css).toMatch(/\.panel[^{]*\{[^}]*box-shadow:\s*var\(--shadow-sm\)/);
  });

  it('ubica la auto-incorporación junto a volver al gestor', async () => {
    await abrir();
    responderListado();
    await fixture.whenStable();
    fixture.detectChanges();

    const css = estilosRegistrados();

    expect(css).toMatch(/\.pagina__acciones[^{]*\{[^}]*justify-content:\s*space-between/);
    expect(css).toMatch(/\.auto__boton[^{]*\{[^}]*min-height:\s*48px/);
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
    expect(scroll?.querySelectorAll('.empleado__enlace').length).toBe(0);

    // La única acción de la fila es la eliminación: no hay acciones para
    // seleccionar al empleado ni para abrir su detalle.
    expect(scroll?.querySelectorAll('button.empleado__eliminar').length).toBe(2);
    expect(scroll?.querySelectorAll('button:not(.empleado__eliminar)').length).toBe(0);
  });

  it('no agrega una descripción redundante de la puntuación promedio', async () => {
    const host = await abrir();
    responderListado();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto(host)).not.toContain('Puntuación promedio');
  });

  describe('SCRUM-269 · Eliminar empleados de la sucursal', () => {
    function botonesEliminar(host: HTMLElement): HTMLButtonElement[] {
      return Array.from(host.querySelectorAll<HTMLButtonElement>('button.empleado__eliminar'));
    }

    function dialogo(): HTMLElement | null {
      return (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
        'ds-modal .ds-modal',
      );
    }

    function botonesDelDialogo(): HTMLButtonElement[] {
      return Array.from(
        (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(
          'ds-modal button',
        ),
      );
    }

    function botonConfirmar(): HTMLButtonElement | null {
      return (
        (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
          'ds-modal .eliminar__confirmar',
        ) ?? null
      );
    }

    it('muestra un botón de eliminar en cada fila, debajo de las reseñas', async () => {
      const host = await abrir();
      responderListado();
      await fixture.whenStable();
      fixture.detectChanges();

      const botones = botonesEliminar(host);
      expect(botones.length).toBe(2);

      const primera = filas(host)[0];
      const rating = primera.querySelector<HTMLElement>('.empleado__rating');
      const boton = primera.querySelector<HTMLButtonElement>('button.empleado__eliminar');

      // El botón vive en la columna de reseñas y puntuación, debajo de ellas.
      expect(rating?.contains(boton as HTMLElement)).toBe(true);
      expect(boton?.getAttribute('aria-label')).toBe('Eliminar a Ana Gómez de la sucursal');
    });

    it('replica el diseño del botón "Finalizar turno" con la paleta roja', async () => {
      await abrir();
      responderListado();
      await fixture.whenStable();
      fixture.detectChanges();

      const css = estilosRegistrados();

      // Mismas propiedades que "Finalizar turno" (turno-detalle-modal.css),
      // con un tamaño compacto para no comer altura de la fila.
      expect(css).toMatch(/\.empleado__eliminar[^{]*\{[^}]*min-width:\s*96px/);
      expect(css).toMatch(/\.empleado__eliminar[^{]*\{[^}]*background:\s*rgba\(255, 122, 122, 0\.16\)/);
      expect(css).toMatch(
        /\.empleado__eliminar[^{]*\{[^}]*border-color:\s*rgba\(255, 122, 122, 0\.32\)/,
      );
      expect(css).toMatch(/\.empleado__eliminar[^{]*:disabled[^{]*\{[^}]*opacity:\s*0\.45/);
      expect(css).toMatch(
        /\.empleado__eliminar[^{]*:hover:not\(:disabled\)[^{]*\{[^}]*background:\s*rgba\(255, 122, 122, 0\.26\)/,
      );

      // Se apoya en el mismo botón del sistema de diseño que "Finalizar turno",
      // pero en su tamaño compacto.
      const boton = botonesEliminar(fixture.nativeElement)[0];
      expect(boton.classList.contains('ds-btn')).toBe(true);
      expect(boton.classList.contains('ds-btn--sm')).toBe(true);
    });

    it('pide confirmación identificando al empleado antes de eliminar', async () => {
      const host = await abrir();
      responderListado();
      await fixture.whenStable();
      fixture.detectChanges();

      botonesEliminar(host)[0].click();
      fixture.detectChanges();

      const modal = dialogo();
      expect(modal).toBeTruthy();
      expect(texto(modal as HTMLElement)).toContain(
        '¿Estás seguro de que deseas eliminar a Ana Gómez de la sucursal?',
      );

      // Todavía no se eliminó a nadie.
      backend.expectNone((request) => request.method === 'DELETE');
      expect(filas(host).length).toBe(2);
    });

    it('no elimina a nadie cuando se cancela la confirmación', async () => {
      const host = await abrir();
      responderListado();
      await fixture.whenStable();
      fixture.detectChanges();

      botonesEliminar(host)[0].click();
      fixture.detectChanges();

      const cancelar = botonesDelDialogo().find((boton) =>
        boton.textContent?.includes('Cancelar'),
      );
      cancelar?.click();
      fixture.detectChanges();

      expect(dialogo()).toBeNull();
      backend.expectNone((request) => request.method === 'DELETE');
      expect(filas(host).length).toBe(2);
    });

    it('elimina al empleado con el endpoint existente y actualiza el listado', async () => {
      const host = await abrir();
      responderListado();
      await fixture.whenStable();
      fixture.detectChanges();

      botonesEliminar(host)[0].click();
      fixture.detectChanges();
      botonConfirmar()?.click();
      fixture.detectChanges();

      const peticion = backend.expectOne(
        (request) =>
          request.method === 'DELETE' &&
          request.url.endsWith('/sucursales/7/empleados/eliminar/10'),
      );
      peticion.flush('Se eliminó al empleado correctamente');
      await fixture.whenStable();
      fixture.detectChanges();

      // El empleado eliminado deja de aparecer sin recargar la página.
      const lista = filas(host);
      expect(lista.length).toBe(1);
      expect(texto(host)).not.toContain('ana@ejemplo.com');
      expect(host.querySelector('.panel__contador')?.textContent?.trim()).toBe('1 Profesional');

      // Y se informa el resultado de la operación.
      const aviso = host.querySelector<HTMLElement>('.aviso--exito');
      expect(aviso?.textContent).toContain('Eliminamos a Ana Gómez de la sucursal.');
      expect(aviso?.getAttribute('role')).toBe('status');
    });

    it('no permite eliminaciones simultáneas sobre el mismo empleado', async () => {
      const host = await abrir();
      responderListado();
      await fixture.whenStable();
      fixture.detectChanges();

      botonesEliminar(host)[0].click();
      fixture.detectChanges();
      botonConfirmar()?.click();
      fixture.detectChanges();

      // Con la eliminación en curso no se puede volver a disparar.
      expect(botonConfirmar()?.disabled).toBe(true);
      botonConfirmar()?.click();
      botonesEliminar(host)[0].click();
      fixture.detectChanges();

      const peticiones = backend.match((request) => request.method === 'DELETE');
      expect(peticiones.length).toBe(1);
      expect(peticiones[0].request.url).toContain('/sucursales/7/empleados/eliminar/10');

      peticiones[0].flush('Se eliminó al empleado correctamente');
      await fixture.whenStable();
      fixture.detectChanges();

      expect(filas(host).length).toBe(1);
    });

    it('conserva al empleado en el listado y avisa cuando la eliminación falla', async () => {
      const host = await abrir();
      responderListado();
      await fixture.whenStable();
      fixture.detectChanges();

      botonesEliminar(host)[0].click();
      fixture.detectChanges();
      botonConfirmar()?.click();
      fixture.detectChanges();

      backend
        .expectOne(
          (request) =>
            request.method === 'DELETE' &&
            request.url.endsWith('/sucursales/7/empleados/eliminar/10'),
        )
        .flush('Error', { status: 500, statusText: 'Error' });
      await fixture.whenStable();
      fixture.detectChanges();

      // El empleado sigue en el listado y el error se muestra inline.
      expect(filas(host).length).toBe(2);
      expect(texto(host)).toContain('ana@ejemplo.com');

      const error = host.querySelector<HTMLElement>('.aviso--error');
      expect(error?.textContent).toContain('No pudimos eliminar al empleado');
      expect(error?.getAttribute('role')).toBe('alert');

      // La pantalla no navega a la vista de error: el error se resuelve inline.
      expect(router.url).toBe(RUTA_BASE);
    });
  });
});
