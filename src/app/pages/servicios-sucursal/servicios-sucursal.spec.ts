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

const FOTO_URL = 'https://example.com/servicio.png';

/**
 * Estilos que Angular registra en el documento al renderizar el componente.
 * jsdom no calcula el layout, así que el alto dinámico del modal se verifica
 * sobre las reglas de CSS y sobre el DOM que se agrega y se quita.
 */
function estilosRegistrados(): string {
  return Array.from(document.querySelectorAll('style'))
    .map((style) => style.textContent ?? '')
    .join('\n');
}

describe('SCRUM-261 · Crear servicios de la sucursal', () => {
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

  async function abrir(url = RUTA_BASE): Promise<HTMLElement> {
    await router.navigateByUrl(url);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    backend.expectOne((request) => request.url.endsWith('/sucursales/7')).flush({
      id: 7,
      nombre: 'Sucursal de prueba',
      fotoPerfil: 'https://example.com/sucursal.jpg',
    });
    backend.expectOne((request) => request.url.includes('/servicios/listar/sucursal')).flush([]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return host();
  }

  function abrirModal(): void {
    const boton = host().querySelector<HTMLButtonElement>('.servicios__acciones button');
    boton?.click();
    fixture.detectChanges();
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
    const input = host().querySelector<HTMLInputElement>('#servicio-foto');
    if (!input) throw new Error('No se encontró el campo de foto');
    const archivo = new File(['contenido'], 'servicio.png', { type: 'image/png' });
    Object.defineProperty(input, 'files', { value: [archivo], configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    fixture.detectChanges();
  }

  function enviar(): void {
    const form = host().querySelector<HTMLFormElement>('.ds-modal form');
    form?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    fixture.detectChanges();
  }

  function mensajesDeError(): HTMLElement[] {
    return Array.from(host().querySelectorAll<HTMLElement>('.ds-modal .ds-error'));
  }

  /** Responde el listado que se vuelve a pedir después de crear un servicio. */
  function responderListado(): void {
    const listados = backend.match((request) => request.url.includes('/servicios/listar/sucursal'));
    for (const listado of listados) listado.flush([]);
  }

  it('vuelve al gestor de la sucursal actual desde Servicios', async () => {
    await abrir();

    host().querySelector<HTMLAnchorElement>('.migas .volver')?.click();
    await fixture.whenStable();

    expect(router.url).toBe('/mis-sucursales?sucursalId=7');
  });

  it('presenta crear servicio en un modal con secciones claras y campos agrupados', async () => {
    await abrir();
    expect(texto(host().querySelector('.servicios__acciones button')!)).toBe('Crear servicio');
    abrirModal();

    const modal = host().querySelector<HTMLElement>('.ds-modal')!;
    const formulario = modal.querySelector<HTMLFormElement>('form.formulario-crear-servicio')!;
    expect(modal.style.maxWidth).toBe('720px');
    expect(texto(modal.querySelector('#crear-servicio-titulo')!)).toBe('Crear servicio');
    expect(texto(formulario.querySelector('#crear-servicio-detalles')!)).toBe('Detalles del servicio');
    expect(texto(formulario.querySelector('#crear-servicio-foto-titulo')!)).toBe('Imagen del servicio');
    expect(formulario.querySelectorAll('.crear-servicio__campo')).toHaveLength(4);
    expect(formulario.querySelector('#servicio-foto-ayuda')).not.toBeNull();
  });

  describe('mensajes de error debajo de cada campo', () => {
    it('muestra un mensaje claro debajo del campo cuando se envía el formulario vacío', async () => {
      await abrir();
      expect(host().querySelector('.servicios__fondo img')?.getAttribute('src'))
        .toBe('https://example.com/sucursal.jpg');
      abrirModal();

      enviar();

      const errores = mensajesDeError();
      const textos = errores.map(texto);

      expect(textos).toContain('Ingresá el nombre del servicio.');
      expect(textos).toContain('Ingresá la descripción.');
      expect(textos).toContain('Ingresá la duración en minutos.');
      expect(textos).toContain('Ingresá el precio del servicio.');
      expect(textos).toContain('Seleccioná una imagen.');
    });

    it('no muestra el resumen de errores: cada mensaje va debajo de su campo', async () => {
      await abrir();
      abrirModal();

      enviar();

      // El bloque "Revisá los siguientes campos:" no debe existir.
      expect(host().querySelector('.resumen-errores')).toBeNull();
      expect(texto(host())).not.toContain('Revisá los siguientes campos');
      expect(texto(host())).not.toContain('Revisá este campo');
    });

    it('ubica cada mensaje dentro del campo al que corresponde, después del control', async () => {
      await abrir();
      abrirModal();

      enviar();

      const esperados: [string, string][] = [
        ['servicio-nombre', 'Ingresá el nombre del servicio.'],
        ['servicio-descripcion', 'Ingresá la descripción.'],
        ['servicio-duracion', 'Ingresá la duración en minutos.'],
        ['servicio-precio', 'Ingresá el precio del servicio.'],
        ['servicio-foto', 'Seleccioná una imagen.'],
      ];

      for (const [id, mensaje] of esperados) {
        const control = host().querySelector<HTMLElement>(`#${id}`);
        const error = Array.from(host().querySelectorAll<HTMLElement>('.ds-modal .ds-error')).find(
          (elemento) => texto(elemento) === mensaje,
        );

        expect(error, `falta el mensaje ${mensaje}`).toBeTruthy();
        // El mensaje vive en el mismo contenedor que el control y después de él.
        expect(error!.parentElement!.contains(control!)).toBe(true);
        expect(control!.compareDocumentPosition(error!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        // El control queda marcado como inválido y descrito por el mensaje.
        expect(control!.getAttribute('aria-invalid')).toBe('true');
        expect(control!.getAttribute('aria-describedby')).toContain(error!.id);
      }
    });

    it('pinta los mensajes en rojo con el token de danger', async () => {
      await abrir();
      abrirModal();

      enviar();

      expect(mensajesDeError().length).toBeGreaterThan(0);
      expect(estilosRegistrados()).toMatch(/\.ds-error[^{]*\{[^}]*color:\s*var\(--danger\)/);
    });

    it('limpia el mensaje del campo cuando el valor vuelve a ser válido', async () => {
      await abrir();
      abrirModal();

      enviar();
      expect(mensajesDeError().length).toBeGreaterThan(0);

      escribir('servicio-nombre', 'Corte de pelo');

      const errorNombre = Array.from(host().querySelectorAll<HTMLElement>('.ds-modal .ds-error')).find(
        (elemento) => texto(elemento) === 'Ingresá el nombre del servicio.',
      );
      expect(errorNombre).toBeUndefined();
    });
  });

  describe('alto dinámico del modal', () => {
    it('no fija alturas en el formulario para que el modal crezca y se reduzca', async () => {
      await abrir();
      abrirModal();

      const estilos = estilosRegistrados();
      // El selector del formulario tiene que empezar por "form" para no confundirlo
      // con palabras como "transform".
      expect(estilos).toMatch(/(^|[};])\s*form[^{]*\{[^}]*height:\s*auto/);
      expect(estilos).not.toMatch(/(^|[};])\s*form[^{]*\{[^}]*height:\s*\d/);
    });

    it('agrega y quita los mensajes del DOM según la validación', async () => {
      await abrir();
      abrirModal();

      const antes = mensajesDeError().length;
      enviar();
      const durante = mensajesDeError().length;

      escribir('servicio-nombre', 'Corte de pelo');
      escribir('servicio-descripcion', 'Corte de pelo para damas y caballeros');
      escribir('servicio-duracion', '60');
      escribir('servicio-precio', '1500.50');

      const despues = Array.from(host().querySelectorAll<HTMLElement>('.ds-modal .ds-error')).filter(
        (elemento) => texto(elemento) !== 'Seleccioná una imagen.',
      ).length;

      expect(antes).toBe(0);
      expect(durante).toBeGreaterThan(antes);
      expect(despues).toBeLessThan(durante);
    });
  });

  describe('valores numéricos', () => {
    it('acepta la duración y el precio escritos con números', async () => {
      await abrir();
      abrirModal();

      escribir('servicio-duracion', '60');
      escribir('servicio-precio', '1500.50');

      const modelo = pagina().model();
      expect(modelo.duracion).toBe(60);
      expect(modelo.precio).toBe(1500.5);
      expect(typeof modelo.duracion).toBe('number');
      expect(typeof modelo.precio).toBe('number');
    });

    it('no marca error de validación cuando los números son válidos', async () => {
      await abrir();
      abrirModal();

      escribir('servicio-duracion', '60');
      escribir('servicio-precio', '1500.50');

      const textos = mensajesDeError().map(texto);
      expect(textos).not.toContain('La duración debe ser un número entero de minutos.');
      expect(textos).not.toContain('El precio debe tener a lo sumo 2 decimales.');
    });

    it('rechaza con un mensaje claro los valores que no son válidos', async () => {
      await abrir();
      abrirModal();

      escribir('servicio-duracion', '45');
      escribir('servicio-precio', '1500.555');
      enviar();

      const textos = mensajesDeError().map(texto);
      expect(textos).toContain('La duración debe ser un múltiplo de 30 minutos (30, 60, 90…).');
      expect(textos).toContain('El precio debe tener a lo sumo 2 decimales.');
    });

    it('envía al backend la duración como entero y el precio como número', async () => {
      await abrir();
      abrirModal();

      escribir('servicio-nombre', 'Corte de pelo');
      escribir('servicio-descripcion', 'Corte de pelo para damas y caballeros');
      escribir('servicio-duracion', '60');
      escribir('servicio-precio', '1500.50');
      elegirFoto();

      enviar();

      const subida = backend.expectOne((request) => request.url.includes('/imagenes/upload'));
      subida.flush({ url: FOTO_URL, publicId: 'servicio-1' });
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const creacion = backend.expectOne((request) => request.url.includes('/servicios/crear'));
      const cuerpo = creacion.request.body;

      expect(cuerpo.sucursalId).toBe(7);
      expect(cuerpo.nombre).toBe('Corte de pelo');
      expect(cuerpo.duracion).toBe(60);
      expect(Number.isInteger(cuerpo.duracion)).toBe(true);
      expect(cuerpo.precio).toBe(1500.5);
      expect(typeof cuerpo.precio).toBe('number');
      expect(cuerpo.fotoUrl).toBe(FOTO_URL);

      creacion.flush('Se creó el servicio');
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      responderListado();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    });
  });

  describe('errores del backend', () => {
    it('muestra el mensaje inline sin cambiar la ruta, sin cerrar el modal y sin perder los datos', async () => {
      await abrir();
      abrirModal();

      escribir('servicio-nombre', 'Corte de pelo');
      escribir('servicio-descripcion', 'Corte de pelo para damas y caballeros');
      escribir('servicio-duracion', '60');
      escribir('servicio-precio', '1500.50');
      elegirFoto();

      const rutaInicial = router.url;
      const navegar = vi.spyOn(router, 'navigate');
      const navegarPorUrl = vi.spyOn(router, 'navigateByUrl');

      enviar();

      const subida = backend.expectOne((request) => request.url.includes('/imagenes/upload'));
      subida.flush({ url: FOTO_URL, publicId: 'servicio-1' });
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const creacion = backend.expectOne((request) => request.url.includes('/servicios/crear'));
      creacion.flush('Error interno del servidor', { status: 500, statusText: 'Server Error' });
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      // La ruta no cambia: el usuario sigue en los servicios de su sucursal.
      expect(router.url).toBe(rutaInicial);
      expect(router.url).not.toContain('/error');
      expect(navegar).not.toHaveBeenCalled();
      expect(navegarPorUrl).not.toHaveBeenCalled();

      // El modal sigue abierto con los valores ingresados.
      expect(host().querySelector('.ds-modal')).toBeTruthy();
      expect((host().querySelector<HTMLInputElement>('#servicio-nombre')!).value).toBe('Corte de pelo');
      expect((host().querySelector<HTMLInputElement>('#servicio-duracion')!).value).toBe('60');
      expect((host().querySelector<HTMLInputElement>('#servicio-precio')!).value).toBe('1500.5');

      // Y el error se muestra como notificación visual dentro del modal.
      const general = host().querySelector<HTMLElement>('.error-general');
      expect(general).toBeTruthy();
      expect(texto(general!)).toContain('Tuvimos un problema al crear el servicio');
    });

    it('mapea al campo correspondiente los errores de validación del backend', async () => {
      await abrir();
      abrirModal();

      escribir('servicio-nombre', 'Corte de pelo');
      escribir('servicio-descripcion', 'Corte de pelo para damas y caballeros');
      escribir('servicio-duracion', '60');
      escribir('servicio-precio', '1500.50');
      elegirFoto();

      enviar();

      backend.expectOne((request) => request.url.includes('/imagenes/upload')).flush({
        url: FOTO_URL,
        publicId: 'servicio-1',
      });
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const creacion = backend.expectOne((request) => request.url.includes('/servicios/crear'));
      creacion.flush(JSON.stringify({ precio: 'El precio no está disponible.' }), {
        status: 400,
        statusText: 'Bad Request',
      });
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const errores = mensajesDeError().map(texto);
      expect(errores).toContain('El precio no está disponible.');
      expect(router.url).toBe(RUTA_BASE);
      expect(host().querySelector('.ds-modal')).toBeTruthy();
    });

    it('muestra en el banner general los errores del backend que no son de un campo', async () => {
      await abrir();
      abrirModal();

      escribir('servicio-nombre', 'Corte de pelo');
      escribir('servicio-descripcion', 'Corte de pelo para damas y caballeros');
      escribir('servicio-duracion', '60');
      escribir('servicio-precio', '1500.50');
      elegirFoto();

      enviar();

      backend.expectOne((request) => request.url.includes('/imagenes/upload')).flush({
        url: FOTO_URL,
        publicId: 'servicio-1',
      });
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const creacion = backend.expectOne((request) => request.url.includes('/servicios/crear'));
      creacion.flush(JSON.stringify({ sucursalId: 'La sucursal no es válida.' }), {
        status: 400,
        statusText: 'Bad Request',
      });
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const general = host().querySelector<HTMLElement>('.error-general');
      expect(general).toBeTruthy();
      expect(texto(general!)).toContain('La sucursal no es válida.');
      expect(router.url).toBe(RUTA_BASE);
    });
  });
});
