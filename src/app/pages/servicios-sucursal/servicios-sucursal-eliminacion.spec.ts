import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, RouterOutlet, provideRouter } from '@angular/router';

import { ServiciosSucursal } from './servicios-sucursal';
import { apiErrorInterceptor } from '../../http/api-errors-service';
import { authInterceptor } from '../../interceptors/auth-interceptor';
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

const RUTA_BASE = '/mis-sucursales/7/servicios';

const FOTO_URL = 'https://example.com/servicio.png';

const SERVICIO = {
  id: 12,
  nombre: 'Corte de pelo',
  descripcion: 'Corte de pelo para damas y caballeros.',
  duracion: 90,
  precio: 1500.5,
  fotoPerfil: FOTO_URL,
  puntuacion: 4.5,
  cantidadPuntuaciones: 3,
};

const AVISO_INICIAL =
  'Eliminar un servicio es un proceso que únicamente puede revertir un administrador. ¿Estás seguro?';

const AVISO_FINAL =
  '¿Estás seguro de que deseas eliminar este servicio permanentemente? Esta acción no se puede deshacer.';

/**
 * Estilos que Angular registra en el documento al renderizar el componente.
 * jsdom no calcula el layout, así que el resplandor del botón se verifica
 * sobre las reglas de CSS.
 */
function estilosRegistrados(): string {
  return Array.from(document.querySelectorAll('style'))
    .map((style) => style.textContent ?? '')
    .join('\n');
}

describe('SCRUM-263 · Eliminar servicios del empleador', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<TestShell>>;
  let router: Router;
  let backend: HttpTestingController;

  const auth = {
    autenticado: signal(false),
    perfil: signal(null),
    tieneAlgunRol: vi.fn<(rol: string) => boolean>(),
    getAccessToken: vi.fn(() => null),
    getRefreshToken: vi.fn(() => null),
    limpiarSesion: vi.fn(),
    renovarSesion: vi.fn(),
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    auth.tieneAlgunRol.mockImplementation((...roles: string[]) => roles.includes('EMPLEADOR'));

    await TestBed.configureTestingModule({
      imports: [TestShell],
      providers: [
        provideRouter([
          { path: 'mis-sucursales/:sucursalId/servicios', component: ServiciosSucursal },
          { path: 'mis-sucursales', component: Dummy },
          { path: '', component: Dummy },
        ]),
        provideHttpClient(withInterceptors([apiErrorInterceptor, authInterceptor])),
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

  /** Texto sin espacios sobrantes: los avisos del template se reparten en varias líneas. */
  function texto(elemento: HTMLElement): string {
    return (elemento.textContent ?? '')
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function pagina(): any {
    return fixture.debugElement.query(By.directive(ServiciosSucursal)).componentInstance;
  }

  function botonPorTexto(valor: string): HTMLButtonElement | undefined {
    return Array.from(host().querySelectorAll<HTMLButtonElement>('button')).find(
      (elemento) => texto(elemento) === valor,
    );
  }

  function confirmacion(): HTMLElement | null {
    return host().querySelector<HTMLElement>('app-servicio-eliminar-modal .ds-modal');
  }

  async function abrir(servicios: unknown[] = [SERVICIO]): Promise<HTMLElement> {
    await router.navigateByUrl(RUTA_BASE);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    backend.expectOne((request) => request.url.endsWith('/sucursales/7')).flush({
      id: 7,
      nombre: 'Sucursal de prueba',
      fotoPerfil: 'https://example.com/sucursal.jpg',
    });
    backend.expectOne((request) => request.url.includes('/servicios/listar/sucursal')).flush(servicios);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return host();
  }

  /** Hace clic en la tarjeta del servicio y responde la consulta del detalle. */
  async function abrirDetalle(servicio: unknown = SERVICIO): Promise<HTMLElement> {
    host().querySelector<HTMLButtonElement>('.card__detalle')?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    backend
      .expectOne(
        (request) => request.method === 'GET' && request.url.endsWith(`/servicios/${SERVICIO.id}`),
      )
      .flush(servicio as Record<string, unknown>);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return host();
  }

  /** Abre la primera confirmación de eliminación desde el detalle. */
  async function abrirConfirmacion(): Promise<HTMLElement> {
    botonPorTexto('Eliminar servicio')?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return host();
  }

  /** Pasa a la segunda confirmación, la última antes de eliminar. */
  async function abrirConfirmacionFinal(): Promise<HTMLElement> {
    botonPorTexto('Continuar')?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return host();
  }

  describe('botón de eliminar', () => {
    it('ofrece el botón de eliminar en rojo, a la izquierda del de modificar', async () => {
      await abrir();
      await abrirDetalle();

      const eliminar = botonPorTexto('Eliminar servicio');
      const modificar = botonPorTexto('Modificar servicio');

      expect(eliminar).toBeTruthy();
      expect(eliminar!.classList.contains('ds-btn--danger')).toBe(true);
      expect(modificar).toBeTruthy();

      // En el pie del detalle el botón de eliminar va primero: queda a la
      // izquierda del de modificar y los dos en la misma fila.
      const botones = Array.from(
        host().querySelectorAll<HTMLButtonElement>('footer.detalle__acciones button'),
      );
      expect(botones.length).toBe(2);
      expect(botones[0]).toBe(eliminar);
      expect(botones[1]).toBe(modificar);
    });

    it('resplandece en rojo al pasar el mouse por encima', async () => {
      await abrir();
      await abrirDetalle();

      expect(estilosRegistrados()).toMatch(
        /\.detalle__boton--eliminar[^{]*:hover[^{]*\{[^}]*box-shadow:\s*0 0 18px rgba\(255, 122, 122/,
      );
    });

    it('no ofrece el botón de eliminar a quien no tiene el rol de empleador', async () => {
      auth.tieneAlgunRol.mockReturnValue(false);

      await abrir();
      await abrirDetalle();

      expect(botonPorTexto('Eliminar servicio')).toBeUndefined();
      // El resto del detalle sigue igual.
      expect(botonPorTexto('Modificar servicio')).toBeTruthy();
    });
  });

  describe('confirmaciones', () => {
    it('pide la primera confirmación y todavía no borra nada', async () => {
      await abrir();
      await abrirDetalle();
      await abrirConfirmacion();

      const dialogo = confirmacion();
      expect(dialogo).toBeTruthy();
      expect(texto(dialogo!)).toContain(AVISO_INICIAL);
      expect(botonPorTexto('Cancelar')).toBeTruthy();
      expect(botonPorTexto('Continuar')).toBeTruthy();

      // El endpoint de eliminación no se tocó todavía.
      backend.expectNone((request) => request.method === 'DELETE');
    });

    it('vuelve a los detalles del servicio al cancelar la primera confirmación', async () => {
      await abrir();
      await abrirDetalle();
      await abrirConfirmacion();

      botonPorTexto('Cancelar')?.click();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(confirmacion()).toBeNull();
      expect(host().querySelector('.detalle')).toBeTruthy();
      expect(texto(host().querySelector('.detalle')!)).toContain('Corte de pelo');

      backend.expectNone((request) => request.method === 'DELETE');
    });

    it('pide la segunda confirmación y todavía no borra nada', async () => {
      await abrir();
      await abrirDetalle();
      await abrirConfirmacion();
      await abrirConfirmacionFinal();

      const dialogo = confirmacion();
      expect(dialogo).toBeTruthy();
      expect(texto(dialogo!)).toContain(AVISO_FINAL);
      expect(botonPorTexto('Cancelar')).toBeTruthy();
      expect(botonPorTexto('Eliminar permanentemente')).toBeTruthy();

      backend.expectNone((request) => request.method === 'DELETE');
    });

    it('no borra nada al cancelar la segunda confirmación', async () => {
      await abrir();
      await abrirDetalle();
      await abrirConfirmacion();
      await abrirConfirmacionFinal();

      botonPorTexto('Cancelar')?.click();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(confirmacion()).toBeNull();
      expect(host().querySelector('.detalle')).toBeTruthy();

      backend.expectNone((request) => request.method === 'DELETE');
    });
  });

  describe('eliminación', () => {
    it('envía al backend el identificador del servicio elegido', async () => {
      await abrir();
      await abrirDetalle();
      await abrirConfirmacion();
      await abrirConfirmacionFinal();

      botonPorTexto('Eliminar permanentemente')?.click();
      fixture.detectChanges();

      const peticion = backend.expectOne(
        (request) => request.method === 'DELETE' && request.url.endsWith('/servicios/eliminar/12'),
      );
      expect(peticion.request.body).toBeNull();

      peticion.flush('Se elimino el servicio correctamente');
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      await responderListado([]);
    });

    it('cierra el detalle, avisa el resultado y actualiza el listado', async () => {
      await abrir();
      await abrirDetalle();
      await abrirConfirmacion();
      await abrirConfirmacionFinal();

      botonPorTexto('Eliminar permanentemente')?.click();
      fixture.detectChanges();

      backend
        .expectOne((request) => request.method === 'DELETE')
        .flush('Se elimino el servicio correctamente');
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      // El detalle y las confirmaciones se cerraron.
      expect(confirmacion()).toBeNull();
      expect(host().querySelector('.detalle')).toBeNull();

      // El listado se vuelve a pedir para que el servicio ya no aparezca.
      const listado = backend.expectOne((request) =>
        request.url.includes('/servicios/listar/sucursal'),
      );
      listado.flush([]);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(host().querySelectorAll('.card__detalle').length).toBe(0);

      const exito = host().querySelector<HTMLElement>('.aviso-exito');
      expect(exito).toBeTruthy();
      expect(texto(exito!)).toBe('El servicio se eliminó correctamente');
      expect(exito!.getAttribute('role')).toBe('status');

      // La pantalla sigue siendo la de los servicios de la sucursal.
      expect(router.url).toBe(RUTA_BASE);
    });

    it('no permite eliminaciones duplicadas', async () => {
      await abrir();
      await abrirDetalle();
      await abrirConfirmacion();
      await abrirConfirmacionFinal();

      botonPorTexto('Eliminar permanentemente')?.click();
      botonPorTexto('Eliminar permanentemente')?.click();
      fixture.detectChanges();

      backend.expectOne((request) => request.method === 'DELETE');
      backend.expectNone((request) => request.method === 'DELETE');

      backend
        .match((request) => request.method === 'DELETE')
        .forEach((peticion) => peticion.flush('Se elimino el servicio correctamente'));
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      await responderListado([]);
    });

    it('muestra el error del backend sin cambiar de ruta ni tocar el listado', async () => {
      await abrir();
      await abrirDetalle();
      await abrirConfirmacion();
      await abrirConfirmacionFinal();

      botonPorTexto('Eliminar permanentemente')?.click();
      fixture.detectChanges();

      backend
        .expectOne((request) => request.method === 'DELETE')
        .flush('No tenes permisos', { status: 403, statusText: 'Forbidden' });
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const error = host().querySelector<HTMLElement>('app-servicio-eliminar-modal [role="alert"]');
      expect(error).toBeTruthy();
      expect(texto(error!)).toContain('No tenés permisos para eliminar servicios de esta sucursal.');

      // No se navega a otra pantalla ni se muestra un éxito falso.
      expect(router.url).toBe(RUTA_BASE);
      expect(router.url).not.toContain('/error');
      expect(host().querySelector('.aviso-exito')).toBeNull();

      // El usuario sigue en el contexto del detalle del servicio.
      expect(host().querySelector('.detalle')).toBeTruthy();

      // El listado no se actualiza como si la eliminación hubiera funcionado.
      backend.expectNone((request) => request.url.includes('/servicios/listar/sucursal'));
    });

    it('no manda al usuario a la página de error cuando el servidor falla', async () => {
      await abrir();
      await abrirDetalle();
      await abrirConfirmacion();
      await abrirConfirmacionFinal();

      botonPorTexto('Eliminar permanentemente')?.click();
      fixture.detectChanges();

      backend
        .expectOne((request) => request.method === 'DELETE')
        .flush('Error interno del servidor', { status: 500, statusText: 'Server Error' });
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const error = host().querySelector<HTMLElement>('app-servicio-eliminar-modal [role="alert"]');
      expect(error).toBeTruthy();
      expect(texto(error!)).toContain('Tuvimos un problema al eliminar el servicio');

      expect(router.url).toBe(RUTA_BASE);
      expect(router.url).not.toContain('/error');
      expect(host().querySelector('.aviso-exito')).toBeNull();
      expect(host().querySelector('.detalle')).toBeTruthy();
    });
  });

  /** Responde el listado que se vuelve a pedir después de eliminar un servicio. */
  async function responderListado(servicios: unknown[]): Promise<void> {
    const listados = backend.match((request) => request.url.includes('/servicios/listar/sucursal'));
    for (const listado of listados) listado.flush(servicios);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }
});
