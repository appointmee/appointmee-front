import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, RouterOutlet, provideRouter } from '@angular/router';

import { MisSucursales } from './mis-sucursales';
import { authService } from '../../services/auth-service';
import { signal } from '@angular/core';

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
  imagenes: ['https://res.cloudinary.com/appointmee/galeria-1.png'],
};

/**
 * Misma sucursal con un horario que no cruza la medianoche: es el que permite
 * guardar, porque el formulario (igual que el alta y que el backend) exige que
 * el cierre sea posterior a la apertura.
 */
const DETALLE_EDITABLE = { ...DETALLE, horaCierre: '18:00' };

describe('SCRUM-265 · Ver y modificar los datos de la sucursal', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<TestShell>>;
  let router: Router;
  let backend: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestShell],
      providers: [
        provideRouter([
          { path: 'mis-sucursales', component: MisSucursales },
          { path: 'sucursal/:id', component: Dummy },
        ]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: authService,
          useValue: {
            perfil: signal({ id: 7, email: 'empleador@ejemplo.com' }),
            tieneAlgunRol: (...roles: string[]) => roles.includes('EMPLEADOR'),
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
  });

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function texto(elemento: HTMLElement): string {
    return (elemento.textContent ?? '').replace(/\u00a0/g, ' ').trim();
  }

  function botonPorTexto(valor: string): HTMLButtonElement | undefined {
    return Array.from(host().querySelectorAll<HTMLButtonElement>('button')).find(
      (elemento) => texto(elemento) === valor,
    );
  }

  /** Carga el listado y entra al gestor de la sucursal. */
  async function abrirGestor(): Promise<void> {
    await router.navigateByUrl('/mis-sucursales');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    backend
      .expectOne((request) => request.url.endsWith('/sucursales/listar/propias'))
      .flush([MINI]);
    fixture.detectChanges();

    host().querySelector<HTMLButtonElement>('.sucursal-card__accion')?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /** Abre el recuadro con los datos de la sucursal. */
  async function abrirDetalle(sucursal: unknown = DETALLE): Promise<void> {
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
      .flush(sucursal as Record<string, unknown>);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /** Abre el formulario de modificación desde el recuadro de detalle. */
  async function abrirFormulario(): Promise<void> {
    botonPorTexto('Modificar sucursal')?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    backend
      .expectOne((request) => request.url.endsWith('/sucursales/categorias/detalle'))
      .flush([{ id: 3, categoria: 'BARBERIA' }]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function escribir(id: string, valor: string): void {
    const control = host().querySelector<HTMLInputElement | HTMLTextAreaElement>(`#${id}`);
    if (!control) throw new Error(`No se encontró el control ${id}`);
    const prototipo =
      control instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototipo, 'value')!.set!.call(control, valor);
    control.dispatchEvent(new Event('input', { bubbles: true }));
    control.dispatchEvent(new Event('blur', { bubbles: true }));
    fixture.detectChanges();
  }

  function enviar(): void {
    const form = host().querySelector<HTMLFormElement>('app-sucursal-editar-modal form');
    form?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    fixture.detectChanges();
  }

  /** Elige una imagen nueva en el formulario de modificación. */
  function elegirFoto(): void {
    const input = host().querySelector<HTMLInputElement>('#sucursal-editar-foto');
    if (!input) throw new Error('No se encontró el campo de foto');
    const archivo = new File(['contenido'], 'sucursal.png', { type: 'image/png' });
    Object.defineProperty(input, 'files', { value: [archivo], configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    fixture.detectChanges();
  }

  /** Responde el listado y el detalle que se vuelven a pedir tras la modificación. */
  async function responderListadoYDetalle(nombre = 'Barber House Centro'): Promise<void> {
    const listados = backend.match((request) => request.url.endsWith('/sucursales/listar/propias'));
    for (const listado of listados) listado.flush([{ ...MINI, nombre }]);

    const detalles = backend.match(
      (request) => request.method === 'GET' && request.url.endsWith(`/sucursales/${SUCURSAL_ID}`),
    );
    for (const detalle of detalles) detalle.flush({ ...DETALLE_EDITABLE, nombre });

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  describe('recuadro con los datos de la sucursal', () => {
    it('se abre al hacer clic en la tarjeta Sucursal y consulta el detalle', async () => {
      await abrirGestor();
      expect(host().querySelector('.ds-modal')).toBeNull();

      await abrirDetalle();

      expect(host().querySelector('.ds-modal')).toBeTruthy();
      expect(texto(host())).toContain('Barber House');
    });

    it('muestra nombre, dirección, teléfono, fecha de creación, categoría y horario', async () => {
      await abrirGestor();
      await abrirDetalle();

      const detalle = host().querySelector<HTMLElement>('.detalle')!;
      expect(texto(detalle)).toContain('Barber House');
      expect(texto(detalle)).toContain('Av. Corrientes 1234, piso 2');
      expect(texto(detalle)).toContain('1134567890');
      expect(texto(detalle)).toContain('15/01/2024');
      expect(texto(detalle)).toContain('Barberia');
      expect(texto(detalle)).toContain('10:00 - 02:00');
      expect(texto(detalle)).toContain('Peluquería/barbería con servicios de corte y color.');
    });

    it('no inventa el teléfono cuando la sucursal no tiene uno', async () => {
      await abrirGestor();
      await abrirDetalle({ ...DETALLE, telefono: null });

      const detalle = host().querySelector<HTMLElement>('.detalle')!;
      expect(texto(detalle)).not.toContain('Teléfono');
      expect(detalle.querySelectorAll('.dato').length).toBe(8);
    });

    it('resalta en amarillo los días que abre y apaga los que no', async () => {
      await abrirGestor();
      await abrirDetalle();

      const dias = host().querySelectorAll<HTMLElement>('.dia');
      expect(dias.length).toBe(7);
      expect(texto(dias[0])).toBe('LU');
      expect(texto(dias[6])).toBe('DO');

      const activos = Array.from(dias).filter((dia) => dia.classList.contains('dia--activo'));
      expect(activos.map((dia) => texto(dia))).toEqual(['LU', 'MA', 'MI', 'JU', 'VI']);
    });

    it('muestra solamente la foto de perfil de la sucursal', async () => {
      await abrirGestor();
      await abrirDetalle();

      const imagenes = host().querySelectorAll<HTMLImageElement>('.detalle__media img');
      expect(imagenes.length).toBe(1);
      expect(imagenes[0].getAttribute('src')).toBe(DETALLE.fotoPerfil);
    });

    it('muestra las abejas, el valor numérico y la cantidad de reseñas', async () => {
      await abrirGestor();
      await abrirDetalle();

      const rating = host().querySelector<HTMLElement>('.rating')!;
      expect(rating.querySelectorAll('.abeja').length).toBe(5);
      expect(rating.querySelectorAll('.abeja:not(.abeja--vacia)').length).toBe(4);
      expect(texto(rating.querySelector('.rating__valor')!)).toBe('4/5');
      expect(texto(rating.querySelector('.rating__resenas')!)).toBe('3 reseñas');
    });

    it('nunca muestra el identificador de la sucursal', async () => {
      await abrirGestor();
      await abrirDetalle();

      const detalle = host().querySelector<HTMLElement>('.detalle')!;
      expect(texto(detalle)).not.toContain(String(SUCURSAL_ID));
    });

    it('ofrece el botón para ir a la sucursal y conserva la navegación original', async () => {
      await abrirGestor();
      await abrirDetalle();

      const enlace = host().querySelector<HTMLAnchorElement>('a.detalle__boton--ir');
      expect(enlace?.textContent?.trim()).toBe('Ir a sucursal');
      expect(enlace?.getAttribute('href')).toBe(`/sucursal/${SUCURSAL_ID}`);

      enlace?.click();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(router.url).toContain(`/sucursal/${SUCURSAL_ID}`);
    });

    it('ofrece el botón amarillo para modificar la sucursal', async () => {
      await abrirGestor();
      await abrirDetalle();

      const boton = botonPorTexto('Modificar sucursal');
      expect(boton).toBeTruthy();
      expect(boton!.classList.contains('ds-btn--primary')).toBe(true);
    });
  });

  describe('formulario de modificación', () => {
    it('precarga los datos de la sucursal en el mismo formulario del alta', async () => {
      await abrirGestor();
      await abrirDetalle(DETALLE_EDITABLE);
      await abrirFormulario();

      const formulario = host().querySelector<HTMLElement>('app-sucursal-editar-modal')!;
      const modal = formulario.querySelector<HTMLElement>('ds-modal')!;
      expect(modal.style.getPropertyValue('--ds-modal-offset-y')).toBe('min(var(--space-6), 4dvh)');
      expect(modal.style.getPropertyValue('--ds-modal-padding')).toBe('var(--space-3)');
      expect(modal.style.getPropertyValue('--sucursal-form-section-padding')).toBe('var(--space-4)');
      expect(formulario.querySelector<HTMLInputElement>('#sucursal-editar-nombre')!.value).toBe(
        'Barber House',
      );
      expect(
        formulario.querySelector<HTMLInputElement>('#sucursal-editar-direccion')!.value,
      ).toBe('Av. Corrientes 1234, piso 2');
      expect(formulario.querySelector<HTMLInputElement>('#sucursal-editar-telefono')!.value).toBe(
        '1134567890',
      );
      expect(
        formulario.querySelector<HTMLTextAreaElement>('#sucursal-editar-descripcion')!.value,
      ).toBe('Peluquería/barbería con servicios de corte y color.');
      expect(
        formulario.querySelector<HTMLButtonElement>(
          '#sucursal-editar-horaApertura-selector-trigger',
        )?.textContent,
      ).toContain('10:00');
      expect(
        formulario.querySelector<HTMLButtonElement>(
          '#sucursal-editar-horaCierre-selector-trigger',
        )?.textContent,
      ).toContain('18:00');
      expect(
        formulario.querySelector<HTMLSelectElement>('#sucursal-editar-categoria')!.value,
      ).toBe('BARBERIA');

      const dias = Array.from(formulario.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
      expect(dias.filter((dia) => dia.checked).length).toBe(5);
    });

    it('mantiene las validaciones del alta: no envía si el nombre es inválido', async () => {
      await abrirGestor();
      await abrirDetalle(DETALLE_EDITABLE);
      await abrirFormulario();

      escribir('sucursal-editar-nombre', 'Bar');
      enviar();

      expect(host().querySelector('.ds-error')?.textContent).toContain(
        'El nombre debe tener al menos 4 caracteres.',
      );
      backend.expectNone((request) => request.method === 'PATCH');
    });

    it('envía la modificación con el formato que espera el backend', async () => {
      await abrirGestor();
      await abrirDetalle(DETALLE_EDITABLE);
      await abrirFormulario();

      escribir('sucursal-editar-nombre', 'Barber House Centro');
      enviar();

      const peticion = backend.expectOne(
        (request) =>
          request.method === 'PATCH' && request.url.endsWith(`/sucursales/modificar/${SUCURSAL_ID}`),
      );
      expect(peticion.request.body).toEqual({
        nombre: 'Barber House Centro',
        direccion: 'Av. Corrientes 1234, piso 2',
        telefono: '1134567890',
        descripcion: 'Peluquería/barbería con servicios de corte y color.',
        categoriaId: 3,
        horaApertura: '10:00',
        horaCierre: '18:00',
        diasApertura: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
      });

      peticion.flush('Se modificó la sucursal');
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      await responderListadoYDetalle();
    });

    it('sube la imagen nueva y la envía junto con su public id', async () => {
      await abrirGestor();
      await abrirDetalle(DETALLE_EDITABLE);
      await abrirFormulario();

      elegirFoto();
      enviar();

      const subida = backend.expectOne((request) => request.url.includes('/imagenes/upload'));
      subida.flush({
        url: 'https://res.cloudinary.com/appointmee/nueva.png',
        publicId: 'appointmee/sucursales/nueva',
      });
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const peticion = backend.expectOne(
        (request) =>
          request.method === 'PATCH' && request.url.endsWith(`/sucursales/modificar/${SUCURSAL_ID}`),
      );
      expect(peticion.request.body.fotoUrl).toBe('https://res.cloudinary.com/appointmee/nueva.png');
      expect(peticion.request.body.fotoPublicId).toBe('appointmee/sucursales/nueva');

      peticion.flush('Se modificó la sucursal');
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      await responderListadoYDetalle();
    });

    it('muestra los errores del backend junto al campo que corresponde', async () => {
      await abrirGestor();
      await abrirDetalle(DETALLE_EDITABLE);
      await abrirFormulario();

      escribir('sucursal-editar-nombre', 'Barber House Centro');
      enviar();

      const peticion = backend.expectOne(
        (request) =>
          request.method === 'PATCH' && request.url.endsWith(`/sucursales/modificar/${SUCURSAL_ID}`),
      );
      peticion.flush({ direccion: 'La direccion ya existe' }, { status: 400, statusText: 'Bad Request' });
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const formulario = host().querySelector<HTMLElement>('app-sucursal-editar-modal')!;
      expect(texto(formulario)).toContain('La direccion ya existe');
    });

    it('pide confirmación antes de descartar los cambios', async () => {
      await abrirGestor();
      await abrirDetalle(DETALLE_EDITABLE);
      await abrirFormulario();

      escribir('sucursal-editar-nombre', 'Barber House Centro');
      botonPorTexto('Cancelar')?.click();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const confirmacion = host().querySelector<HTMLElement>('.descartar');
      expect(confirmacion).toBeTruthy();
      expect(texto(confirmacion!)).toContain('¿Estás seguro de que querés descartar los cambios?');
    });

    it('no pide confirmación cuando no hay cambios', async () => {
      await abrirGestor();
      await abrirDetalle(DETALLE_EDITABLE);
      await abrirFormulario();

      botonPorTexto('Cancelar')?.click();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(host().querySelector('.descartar')).toBeNull();
      expect(host().querySelector('app-sucursal-editar-modal form')).toBeNull();
    });

    it('avisa los cambios guardados y actualiza el recuadro de detalle', async () => {
      await abrirGestor();
      await abrirDetalle(DETALLE_EDITABLE);
      await abrirFormulario();

      escribir('sucursal-editar-nombre', 'Barber House Centro');
      enviar();

      const peticion = backend.expectOne(
        (request) =>
          request.method === 'PATCH' && request.url.endsWith(`/sucursales/modificar/${SUCURSAL_ID}`),
      );
      peticion.flush('Se modificó la sucursal');
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      // El recuadro vuelve a consultar la sucursal para mostrar los datos nuevos.
      await responderListadoYDetalle();

      const detalle = host().querySelector<HTMLElement>('.detalle')!;
      expect(texto(detalle)).toContain('Cambios guardados');
      expect(texto(detalle)).toContain('Barber House Centro');
      expect(host().querySelector('app-sucursal-editar-modal form')).toBeNull();
    });
  });
});
