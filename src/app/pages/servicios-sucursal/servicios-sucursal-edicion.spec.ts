import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, RouterOutlet, provideRouter } from '@angular/router';

import { ServiciosSucursal } from './servicios-sucursal';
import { apiErrorInterceptor } from '../../http/api-errors-service';
import { authInterceptor } from '../../interceptors/auth-interceptor';

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

const FOTO_URL = 'https://res.cloudinary.com/appointmee/image/upload/appointmee/servicios/corte.png';
const FOTO_NUEVA_URL = 'https://res.cloudinary.com/appointmee/image/upload/appointmee/servicios/nueva.png';

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

describe('SCRUM-262 · Consultar y modificar servicios de la sucursal', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<TestShell>>;
  let router: Router;
  let backend: HttpTestingController;

  beforeEach(async () => {
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

  function texto(elemento: HTMLElement): string {
    return (elemento.textContent ?? '').replace(/\u00a0/g, ' ').trim();
  }

  function pagina(): any {
    return fixture.debugElement.query(By.directive(ServiciosSucursal)).componentInstance;
  }

  /** Carga el listado con un servicio y espera a que la pantalla se estabilice. */
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

  /** Hace clic en la tarjeta de un servicio y responde la consulta del detalle. */
  async function abrirDetalle(servicio: unknown = SERVICIO): Promise<HTMLElement> {
    const boton = host().querySelector<HTMLButtonElement>('.card__detalle');
    boton?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const detalle = backend.expectOne(
      (request) => request.method === 'GET' && request.url.endsWith(`/servicios/${SERVICIO.id}`),
    );
    detalle.flush(servicio as Record<string, unknown>);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return host();
  }

  /** Abre el formulario de modificación desde el detalle. */
  async function abrirFormulario(): Promise<HTMLElement> {
    const boton = Array.from(host().querySelectorAll<HTMLButtonElement>('button')).find(
      (elemento) => texto(elemento) === 'Modificar servicio',
    );
    boton?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return host();
  }

  function escribir(id: string, valor: string): void {
    const control = host().querySelector<HTMLInputElement | HTMLTextAreaElement>(`#${id}`);
    if (!control) throw new Error(`No se encontró el control ${id}`);
    const prototipo =
      control instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototipo, 'value')!.set!.call(control, valor);
    control.dispatchEvent(new Event('input', { bubbles: true }));
    control.dispatchEvent(new Event('blur', { bubbles: true }));
    fixture.detectChanges();
  }

  function elegirFoto(): void {
    const input = host().querySelector<HTMLInputElement>('#servicio-editar-foto');
    if (!input) throw new Error('No se encontró el campo de foto');
    const archivo = new File(['contenido'], 'servicio.png', { type: 'image/png' });
    Object.defineProperty(input, 'files', { value: [archivo], configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    fixture.detectChanges();
  }

  /** Espera a que el FileReader genere la vista previa de la imagen. */
  async function esperarVistaPrevia(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 30));
    fixture.detectChanges();
  }

  function enviar(): void {
    const form = host().querySelector<HTMLFormElement>('app-servicio-editar-modal form');
    form?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    fixture.detectChanges();
  }

  function botonPorTexto(valor: string): HTMLButtonElement | undefined {
    return Array.from(host().querySelectorAll<HTMLButtonElement>('button')).find(
      (elemento) => texto(elemento) === valor,
    );
  }

  describe('detalle del servicio', () => {
    it('abre el detalle del servicio al hacer clic en la tarjeta del listado', async () => {
      await abrir();

      const tarjetas = host().querySelectorAll('.card__detalle');
      expect(tarjetas.length).toBe(1);
      expect(tarjetas[0].getAttribute('aria-label')).toBe('Ver detalles de Corte de pelo');

      await abrirDetalle();

      expect(host().querySelector('.ds-modal')).toBeTruthy();
      expect(texto(host())).toContain('Corte de pelo');
    });

    it('muestra nombre, descripción, duración, precio y foto del servicio', async () => {
      await abrir();
      await abrirDetalle();

      const detalle = host().querySelector<HTMLElement>('.detalle')!;
      expect(texto(detalle)).toContain('Corte de pelo');
      expect(texto(detalle)).toContain('Corte de pelo para damas y caballeros.');
      expect(texto(detalle)).toContain('1 hora y 30 minutos');
      expect(texto(detalle)).toContain('1.500,50');

      const foto = detalle.querySelector<HTMLImageElement>('.detalle__media img');
      expect(foto?.getAttribute('src')).toBe(FOTO_URL);
    });

    it('muestra las abejas, el valor numérico y la cantidad de reseñas', async () => {
      await abrir();
      await abrirDetalle();

      const rating = host().querySelector<HTMLElement>('.rating')!;
      expect(rating.querySelectorAll('.abeja').length).toBe(5);
      // La puntuación se redondea como en el resto de la aplicación: 4.5 de 5.
      expect(rating.querySelectorAll('.abeja:not(.abeja--vacia)').length).toBe(5);
      expect(texto(rating.querySelector('.rating__valor')!)).toBe('4,5/5');
      expect(texto(rating.querySelector('.rating__resenas')!)).toBe('3 reseñas');
    });

    it('representa el estado sin reseñas sin inventar puntuaciones', async () => {
      await abrir();
      await abrirDetalle({ ...SERVICIO, puntuacion: null, cantidadPuntuaciones: 0 });

      const rating = host().querySelector<HTMLElement>('.rating')!;
      expect(rating.querySelectorAll('.abeja').length).toBe(0);
      expect(texto(rating)).toContain('Sin puntuaciones');
      expect(texto(rating)).not.toContain('/5');
    });

    it('ofrece el botón amarillo para modificar el servicio', async () => {
      await abrir();
      await abrirDetalle();

      const boton = botonPorTexto('Modificar servicio');
      expect(boton).toBeTruthy();
      expect(boton!.classList.contains('ds-btn--primary')).toBe(true);
    });
  });

  describe('formulario de modificación', () => {
    it('precarga los datos del servicio: nunca muestra los campos vacíos', async () => {
      await abrir();
      await abrirDetalle();
      await abrirFormulario();

      expect(host().querySelector<HTMLInputElement>('#servicio-editar-nombre')!.value).toBe(
        'Corte de pelo',
      );
      expect(
        host().querySelector<HTMLTextAreaElement>('#servicio-editar-descripcion')!.value,
      ).toBe('Corte de pelo para damas y caballeros.');
      expect(host().querySelector<HTMLInputElement>('#servicio-editar-duracion')!.value).toBe('90');
      expect(host().querySelector<HTMLInputElement>('#servicio-editar-precio')!.value).toBe('1500.5');
    });

    it('muestra la vista previa de la foto existente y permite reemplazarla', async () => {
      await abrir();
      await abrirDetalle();
      await abrirFormulario();

      const previa = host().querySelector<HTMLImageElement>('.foto-preview');
      expect(previa?.getAttribute('src')).toBe(FOTO_URL);

      elegirFoto();
      await esperarVistaPrevia();

      expect(host().querySelector<HTMLImageElement>('.foto-preview')!.getAttribute('src')).not.toBe(
        FOTO_URL,
      );
    });

    it('envía al backend solo los campos modificados', async () => {
      await abrir();
      await abrirDetalle();
      await abrirFormulario();

      escribir('servicio-editar-nombre', 'Corte de pelo premium');

      enviar();

      const peticion = backend.expectOne(
        (request) => request.method === 'PATCH' && request.url.endsWith('/servicios/modificar/12'),
      );
      expect(peticion.request.body).toEqual({ nombre: 'Corte de pelo premium' });

      peticion.flush('Se modificó el servicio correctamente');
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      await responderListadoYDetalle();
    });

    it('sube la imagen nueva y la envía junto con su public id', async () => {
      await abrir();
      await abrirDetalle();
      await abrirFormulario();

      elegirFoto();
      enviar();

      const subida = backend.expectOne((request) => request.url.includes('/imagenes/upload'));
      subida.flush({ url: FOTO_NUEVA_URL, publicId: 'appointmee/servicios/nueva' });
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const peticion = backend.expectOne(
        (request) => request.method === 'PATCH' && request.url.endsWith('/servicios/modificar/12'),
      );
      expect(peticion.request.body.fotoUrl).toBe(FOTO_NUEVA_URL);
      expect(peticion.request.body.fotoPublicId).toBe('appointmee/servicios/nueva');

      peticion.flush('Se modificó el servicio correctamente');
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      await responderListadoYDetalle();
    });

    it('conserva la imagen actual cuando no se elige una foto nueva', async () => {
      await abrir();
      await abrirDetalle();
      await abrirFormulario();

      escribir('servicio-editar-precio', '2000');
      enviar();

      const peticion = backend.expectOne(
        (request) => request.method === 'PATCH' && request.url.endsWith('/servicios/modificar/12'),
      );
      expect(peticion.request.body.fotoUrl).toBeUndefined();
      expect(peticion.request.body.fotoPublicId).toBeUndefined();

      peticion.flush('Se modificó el servicio correctamente');
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      await responderListadoYDetalle();
    });

    it('exige los mismos datos que la creación de servicios', async () => {
      await abrir();
      await abrirDetalle();
      await abrirFormulario();

      escribir('servicio-editar-duracion', '45');
      escribir('servicio-editar-precio', '1500.555');
      enviar();

      const errores = Array.from(
        host().querySelectorAll<HTMLElement>('app-servicio-editar-modal .ds-error'),
      ).map(texto);
      expect(errores).toContain('La duración debe ser un múltiplo de 30 minutos (30, 60, 90…).');
      expect(errores).toContain('El precio debe tener a lo sumo 2 decimales.');

      // Con el formulario inválido no se manda nada al backend.
      backend.expectNone((request) => request.url.includes('/servicios/modificar'));
    });

    it('invalida el formulario si se borra un campo obligatorio', async () => {
      await abrir();
      await abrirDetalle();
      await abrirFormulario();

      escribir('servicio-editar-nombre', '');

      const boton = botonPorTexto('Modificar servicio');
      const formulario = host().querySelector<HTMLButtonElement>('app-servicio-editar-modal button[type="submit"]');
      expect(formulario).toBeTruthy();
      expect(formulario!.disabled).toBe(true);
      expect(boton).toBeTruthy();
    });

    it('no permite envíos duplicados durante una actualización', async () => {
      await abrir();
      await abrirDetalle();
      await abrirFormulario();

      escribir('servicio-editar-nombre', 'Corte de pelo premium');
      enviar();
      enviar();

      backend.expectOne(
        (request) => request.method === 'PATCH' && request.url.endsWith('/servicios/modificar/12'),
      );
      backend.expectNone((request) => request.method === 'PATCH');

      backend
        .match((request) => request.method === 'PATCH')
        .forEach((peticion) => peticion.flush('Se modificó el servicio correctamente'));
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      await responderListadoYDetalle();
    });
  });

  describe('errores del servidor', () => {
    it('mantiene el formulario abierto y conserva los datos ingresados', async () => {
      await abrir();
      await abrirDetalle();
      await abrirFormulario();

      escribir('servicio-editar-nombre', 'Corte de pelo premium');
      enviar();

      backend
        .expectOne((request) => request.method === 'PATCH')
        .flush('Error interno del servidor', { status: 500, statusText: 'Server Error' });
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      // El formulario sigue abierto con lo que el empleador escribió.
      expect(host().querySelector('app-servicio-editar-modal form')).toBeTruthy();
      expect(host().querySelector<HTMLInputElement>('#servicio-editar-nombre')!.value).toBe(
        'Corte de pelo premium',
      );

      const general = host().querySelector<HTMLElement>('app-servicio-editar-modal .error-general');
      expect(general).toBeTruthy();
      expect(texto(general!)).toContain('Tuvimos un problema al modificar el servicio');

      // No se navega a otra pantalla.
      expect(router.url).toBe(RUTA_BASE);
      expect(router.url).not.toContain('/error');
    });

    it('mapea al campo correspondiente los errores de validación del backend', async () => {
      await abrir();
      await abrirDetalle();
      await abrirFormulario();

      escribir('servicio-editar-precio', '3000');
      enviar();

      backend
        .expectOne((request) => request.method === 'PATCH')
        .flush(JSON.stringify({ precio: 'El precio no está disponible.' }), {
          status: 400,
          statusText: 'Bad Request',
        });
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const errores = Array.from(
        host().querySelectorAll<HTMLElement>('app-servicio-editar-modal .ds-error'),
      ).map(texto);
      expect(errores).toContain('El precio no está disponible.');
      expect(host().querySelector('app-servicio-editar-modal form')).toBeTruthy();
    });
  });

  describe('descartar cambios', () => {
    it('pide confirmación antes de descartar los cambios', async () => {
      await abrir();
      await abrirDetalle();
      await abrirFormulario();

      escribir('servicio-editar-nombre', 'Corte de pelo premium');
      botonPorTexto('Cancelar')?.click();
      fixture.detectChanges();

      const confirmacion = host().querySelector<HTMLElement>('app-servicio-editar-modal .descartar');
      expect(confirmacion).toBeTruthy();
      expect(texto(confirmacion!)).toContain('¿Estás seguro de que querés descartar los cambios?');
      expect(botonPorTexto('Seguir editando')).toBeTruthy();
      expect(botonPorTexto('Descartar cambios')).toBeTruthy();
    });

    it('vuelve a los detalles del servicio al descartar los cambios', async () => {
      await abrir();
      await abrirDetalle();
      await abrirFormulario();

      escribir('servicio-editar-nombre', 'Corte de pelo premium');
      botonPorTexto('Cancelar')?.click();
      fixture.detectChanges();

      botonPorTexto('Descartar cambios')?.click();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      // El formulario se cerró y se vuelve al detalle del servicio.
      expect(host().querySelector('app-servicio-editar-modal form')).toBeNull();
      expect(host().querySelector('.detalle')).toBeTruthy();
      expect(texto(host().querySelector('.detalle')!)).toContain('Corte de pelo');

      // No se envió nada al backend.
      backend.expectNone((request) => request.url.includes('/servicios/modificar'));
    });

    it('permite seguir editando sin perder los cambios', async () => {
      await abrir();
      await abrirDetalle();
      await abrirFormulario();

      escribir('servicio-editar-nombre', 'Corte de pelo premium');
      botonPorTexto('Cancelar')?.click();
      fixture.detectChanges();

      botonPorTexto('Seguir editando')?.click();
      fixture.detectChanges();

      expect(host().querySelector('app-servicio-editar-modal .descartar')).toBeNull();
      expect(host().querySelector<HTMLInputElement>('#servicio-editar-nombre')!.value).toBe(
        'Corte de pelo premium',
      );
    });

    it('cierra sin confirmación cuando no hubo modificaciones', async () => {
      await abrir();
      await abrirDetalle();
      await abrirFormulario();

      botonPorTexto('Cancelar')?.click();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(host().querySelector('app-servicio-editar-modal .descartar')).toBeNull();
      expect(host().querySelector('app-servicio-editar-modal form')).toBeNull();
      expect(host().querySelector('.detalle')).toBeTruthy();
    });
  });

  describe('actualización exitosa', () => {
    it('muestra el mensaje de éxito y refresca el detalle y el listado', async () => {
      await abrir();
      await abrirDetalle();
      await abrirFormulario();

      escribir('servicio-editar-nombre', 'Corte de pelo premium');
      enviar();

      backend
        .expectOne((request) => request.method === 'PATCH')
        .flush('Se modificó el servicio correctamente');
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      // El detalle vuelve a consultarse y el listado se refresca.
      const detalle = backend.expectOne(
        (request) => request.method === 'GET' && request.url.endsWith(`/servicios/${SERVICIO.id}`),
      );
      detalle.flush({ ...SERVICIO, nombre: 'Corte de pelo premium' });
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const listado = backend.expectOne((request) =>
        request.url.includes('/servicios/listar/sucursal'),
      );
      listado.flush([{ ...SERVICIO, nombre: 'Corte de pelo premium' }]);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const exito = host().querySelector<HTMLElement>('.detalle__exito');
      expect(exito).toBeTruthy();
      expect(texto(exito!)).toBe('El servicio se modificó correctamente');
      // El modal de detalle sigue abierto: el usuario puede ver el mensaje.
      expect(host().querySelector('.detalle')).toBeTruthy();
    });
  });

  /** Responde el listado y el detalle que se vuelven a pedir tras la modificación. */
  async function responderListadoYDetalle(): Promise<void> {
    const listados = backend.match((request) => request.url.includes('/servicios/listar/sucursal'));
    for (const listado of listados) listado.flush([{ ...SERVICIO, nombre: 'Corte de pelo premium' }]);

    const detalles = backend.match(
      (request) => request.method === 'GET' && request.url.endsWith(`/servicios/${SERVICIO.id}`),
    );
    for (const detalle of detalles) detalle.flush({ ...SERVICIO, nombre: 'Corte de pelo premium' });

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }
});
