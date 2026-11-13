import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, RouterOutlet, provideRouter } from '@angular/router';

import { MisSucursales } from './mis-sucursales';
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

const RUTA_BASE = '/mis-sucursales';

const SUCURSAL_ID = 77;

const MINI = {
  id: SUCURSAL_ID,
  nombre: 'Barber House',
  categoria: 'BARBERIA',
  fotoPerfil: 'https://res.cloudinary.com/appointmee/barber.png',
  puntuacion: 4,
  cantidadPuntuaciones: 2,
};

const DETALLE = {
  id: SUCURSAL_ID,
  nombre: 'Barber House',
  direccion: 'Av. Corrientes 1234, piso 2',
  telefono: '1134567890',
  descripcion: 'Peluquería/barbería con servicios de corte y color.',
  fechaCreacion: '2024-01-15',
  categoria: 'BARBERIA',
  horaApertura: '10:00',
  horaCierre: '02:00',
  diasApertura: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
  puntuacion: 4,
  cantidadPuntuaciones: 3,
  fotoPerfil: 'https://res.cloudinary.com/appointmee/barber.png',
  imagenes: [],
};

/** Aviso exacto de la primera confirmación. */
const AVISO_INICIAL =
  'Este es un procedimiento definitivo, solo un administrador puede revertirlo y no esta garantizado, desea continuar?';

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

describe('SCRUM-267 · Eliminar sucursales (empleador)', () => {
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
          { path: 'mis-sucursales', component: MisSucursales },
          { path: 'sucursal/:id', component: Dummy },
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

  function botonPorTexto(valor: string): HTMLButtonElement | undefined {
    return Array.from(host().querySelectorAll<HTMLButtonElement>('button')).find(
      (elemento) => texto(elemento) === valor,
    );
  }

  function confirmacion(): HTMLElement | null {
    return host().querySelector<HTMLElement>('app-sucursal-eliminar-modal .ds-modal');
  }

  /** Carga el listado y entra al gestor de la sucursal. */
  async function abrirGestor(): Promise<void> {
    await router.navigateByUrl(RUTA_BASE);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    backend
      .expectOne((request) => request.url.endsWith('/sucursales/listar/propias'))
      .flush([MINI]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    host().querySelector<HTMLButtonElement>('.sucursal-card__accion')?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /** Abre el recuadro con los datos de la sucursal. */
  async function abrirDetalle(): Promise<void> {
    const tarjeta = Array.from(host().querySelectorAll<HTMLButtonElement>('.tarjeta')).find(
      (elemento) => texto(elemento) === 'Sucursal',
    );
    tarjeta?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    backend
      .expectOne(
        (request) => request.method === 'GET' && request.url.endsWith(`/sucursales/${SUCURSAL_ID}`),
      )
      .flush(DETALLE);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /** Abre la primera confirmación de eliminación desde el recuadro de detalle. */
  async function abrirConfirmacion(): Promise<void> {
    botonPorTexto('Eliminar sucursal')?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /** Pasa a la segunda confirmación, la última antes de eliminar. */
  async function abrirConfirmacionFinal(): Promise<void> {
    botonPorTexto('Continuar')?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /** Responde el listado que se vuelve a pedir después de eliminar una sucursal. */
  async function responderListado(sucursales: unknown[]): Promise<void> {
    const listados = backend.match((request) => request.url.endsWith('/sucursales/listar/propias'));
    for (const listado of listados) listado.flush(sucursales);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  describe('botón de eliminar', () => {
    it('ofrece el botón de eliminar entre el de ir a la sucursal y el de modificar', async () => {
      await abrirGestor();
      await abrirDetalle();

      const eliminar = botonPorTexto('Eliminar sucursal');
      const modificar = botonPorTexto('Modificar sucursal');
      const ir = host().querySelector<HTMLAnchorElement>('a.detalle__boton--ir');

      expect(eliminar).toBeTruthy();
      expect(ir).toBeTruthy();
      expect(modificar).toBeTruthy();

      // El orden visual pedido: Ir a sucursal | Eliminar sucursal | Modificar sucursal.
      const acciones = Array.from(
        host().querySelectorAll<HTMLElement>('footer.detalle__acciones > *'),
      );
      expect(acciones.length).toBe(3);
      expect(acciones[0]).toBe(ir);
      expect(acciones[1]).toBe(eliminar);
      expect(acciones[2]).toBe(modificar);
    });

    it('ofrece el botón de eliminar en rojo', async () => {
      await abrirGestor();
      await abrirDetalle();

      const eliminar = botonPorTexto('Eliminar sucursal');
      expect(eliminar!.classList.contains('ds-btn--danger')).toBe(true);
    });

    it('resplandece en rojo al pasar el mouse por encima', async () => {
      await abrirGestor();
      await abrirDetalle();

      expect(estilosRegistrados()).toMatch(
        /\.detalle__boton--eliminar[^{]*:hover[^{]*\{[^}]*box-shadow:\s*0 0 18px rgba\(255, 122, 122/,
      );
    });

    it('no ofrece el botón de eliminar a quien no tiene el rol de empleador', async () => {
      auth.tieneAlgunRol.mockReturnValue(false);

      await abrirGestor();
      await abrirDetalle();

      expect(botonPorTexto('Eliminar sucursal')).toBeUndefined();
      // El resto del detalle sigue igual.
      expect(botonPorTexto('Modificar sucursal')).toBeTruthy();
      expect(host().querySelector('a.detalle__boton--ir')).toBeTruthy();
    });
  });

  describe('confirmaciones', () => {
    it('pide la primera confirmación y todavía no borra nada', async () => {
      await abrirGestor();
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

    it('vuelve a los datos de la sucursal al cancelar la primera confirmación', async () => {
      await abrirGestor();
      await abrirDetalle();
      await abrirConfirmacion();

      botonPorTexto('Cancelar')?.click();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(confirmacion()).toBeNull();
      expect(host().querySelector('.detalle')).toBeTruthy();
      expect(texto(host().querySelector('.detalle')!)).toContain('Barber House');

      backend.expectNone((request) => request.method === 'DELETE');
    });

    it('pide la segunda confirmación y todavía no borra nada', async () => {
      await abrirGestor();
      await abrirDetalle();
      await abrirConfirmacion();
      await abrirConfirmacionFinal();

      const dialogo = confirmacion();
      expect(dialogo).toBeTruthy();
      // La segunda confirmación deja claro qué sucursal se va a eliminar.
      expect(texto(dialogo!)).toContain('Vas a eliminar la sucursal');
      expect(texto(dialogo!)).toContain('Barber House');
      expect(texto(dialogo!)).toContain('de forma permanente');
      expect(botonPorTexto('Cancelar')).toBeTruthy();
      expect(botonPorTexto('Eliminar permanentemente')).toBeTruthy();

      backend.expectNone((request) => request.method === 'DELETE');
    });

    it('no borra nada al cancelar la segunda confirmación', async () => {
      await abrirGestor();
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
    it('envía al backend el identificador de la sucursal elegida', async () => {
      await abrirGestor();
      await abrirDetalle();
      await abrirConfirmacion();
      await abrirConfirmacionFinal();

      botonPorTexto('Eliminar permanentemente')?.click();
      fixture.detectChanges();

      const peticion = backend.expectOne(
        (request) =>
          request.method === 'DELETE' &&
          request.url.endsWith(`/sucursales/borrar-sucursal-propia/${SUCURSAL_ID}`),
      );
      expect(peticion.request.body).toBeNull();

      peticion.flush('Se eliminó la sucursal');
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      await responderListado([]);
    });

    it('vuelve a mis sucursales, avisa el resultado y actualiza el listado', async () => {
      await abrirGestor();
      await abrirDetalle();
      await abrirConfirmacion();
      await abrirConfirmacionFinal();

      botonPorTexto('Eliminar permanentemente')?.click();
      fixture.detectChanges();

      backend
        .expectOne((request) => request.method === 'DELETE')
        .flush('Se eliminó la sucursal');
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      // El recuadro de detalle y las confirmaciones se cerraron.
      expect(confirmacion()).toBeNull();
      expect(host().querySelector('.detalle')).toBeNull();

      // Se vuelve al listado de "Mis sucursales".
      expect(router.url).toBe(RUTA_BASE);

      // El listado se vuelve a pedir para que la sucursal ya no aparezca.
      const listado = backend.expectOne((request) =>
        request.url.endsWith('/sucursales/listar/propias'),
      );
      listado.flush([]);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(texto(host())).not.toContain('Barber House');

      const exito = host().querySelector<HTMLElement>('.aviso--exito');
      expect(exito).toBeTruthy();
      expect(texto(exito!)).toBe('La sucursal se eliminó correctamente');
      expect(exito!.getAttribute('role')).toBe('status');
    });

    it('no oculta la sucursal antes de que el backend confirme la eliminación', async () => {
      await abrirGestor();
      await abrirDetalle();
      await abrirConfirmacion();
      await abrirConfirmacionFinal();

      botonPorTexto('Eliminar permanentemente')?.click();
      fixture.detectChanges();

      // La petición todavía no se respondió: el listado no se toca.
      backend.expectOne((request) => request.method === 'DELETE');
      backend.expectNone((request) => request.url.endsWith('/sucursales/listar/propias'));

      backend
        .match((request) => request.method === 'DELETE')
        .forEach((peticion) => peticion.flush('Se eliminó la sucursal'));
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      await responderListado([]);
    });

    it('no permite eliminaciones duplicadas', async () => {
      await abrirGestor();
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
        .forEach((peticion) => peticion.flush('Se eliminó la sucursal'));
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      await responderListado([]);
    });

    it('muestra el error del backend sin cambiar de ruta ni tocar el listado', async () => {
      await abrirGestor();
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

      const error = host().querySelector<HTMLElement>('app-sucursal-eliminar-modal [role="alert"]');
      expect(error).toBeTruthy();
      expect(texto(error!)).toContain('No tenés permisos para eliminar esta sucursal.');

      // No se navega a otra pantalla ni se muestra un éxito falso.
      expect(router.url).not.toContain('/error');
      expect(host().querySelector('.aviso--exito')).toBeNull();

      // El usuario sigue en el contexto del detalle de la sucursal.
      expect(host().querySelector('.detalle')).toBeTruthy();

      // El listado no se actualiza como si la eliminación hubiera funcionado.
      backend.expectNone((request) => request.url.endsWith('/sucursales/listar/propias'));
    });

    it('no manda al usuario a la página de error cuando el servidor falla', async () => {
      await abrirGestor();
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

      const error = host().querySelector<HTMLElement>('app-sucursal-eliminar-modal [role="alert"]');
      expect(error).toBeTruthy();
      expect(texto(error!)).toContain('Tuvimos un problema al eliminar la sucursal');

      expect(router.url).not.toContain('/error');
      expect(host().querySelector('.aviso--exito')).toBeNull();
      expect(host().querySelector('.detalle')).toBeTruthy();
    });
  });
});
