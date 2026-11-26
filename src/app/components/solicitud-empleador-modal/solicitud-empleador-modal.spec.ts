import { ComponentFixture, TestBed } from '@angular/core/testing';

import { googlePlacesService } from '../../services/google-places-service';
import { SolicitudEmpleadorModal } from './solicitud-empleador-modal';

const DIRECCIONES = [
  'Av. Corrientes 1234, CABA, Argentina',
  'Av. Santa Fe 3253, CABA, Argentina',
];

describe('SolicitudEmpleadorModal · ubicaciones con Google Places', () => {
  let fixture: ComponentFixture<SolicitudEmpleadorModal>;
  let descriptorShowModal: PropertyDescriptor | undefined;
  let fallo: string | null;

  const lugares = {
    iniciarSesion: vi.fn(),
    buscar: vi.fn(),
    obtenerDetalles: vi.fn(),
    estado: () => 'listo',
    fallo: () => fallo,
  };

  function sugerencia(texto: string) {
    return { id: `ChIJ_${texto.replace(/\W/g, '').slice(0, 40)}`, descripcion: texto };
  }

  beforeEach(async () => {
    fallo = null;
    vi.resetAllMocks();
    lugares.iniciarSesion.mockResolvedValue({ token: 1 });
    lugares.buscar.mockImplementation(async (texto: string) => [sugerencia(texto)]);
    lugares.obtenerDetalles.mockImplementation(async (sugerenciaElegida) => ({
      direccion: sugerenciaElegida.descripcion,
      latitud: -34.6037,
      longitud: -58.3816,
      googlePlaceId: sugerenciaElegida.id,
    }));

    descriptorShowModal = Object.getOwnPropertyDescriptor(
      HTMLDialogElement.prototype,
      'showModal',
    );
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.setAttribute('open', '');
      },
    });

    await TestBed.configureTestingModule({
      imports: [SolicitudEmpleadorModal],
      providers: [{ provide: googlePlacesService, useValue: lugares }],
    }).compileComponents();

    fixture = TestBed.createComponent(SolicitudEmpleadorModal);
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
    fixture.destroy();
    document.body.classList.remove('modal-abierto');

    if (descriptorShowModal) {
      Object.defineProperty(HTMLDialogElement.prototype, 'showModal', descriptorShowModal);
    } else {
      delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).showModal;
    }
  });

  function raiz(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function escribir(selector: string, valor: string): void {
    const campo = raiz().querySelector<HTMLTextAreaElement | HTMLInputElement>(selector);
    if (!campo) throw new Error(`No se encontró el campo ${selector}`);

    const proto = campo instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(campo, valor);
    campo.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
  }

  function escribirComentario(valor: string): void {
    escribir('#solicitud-motivo', valor);
  }

  function escribirDireccion(valor: string): void {
    escribir('#solicitud-direccion', valor);
  }

  async function buscar(texto: string): Promise<void> {
    vi.useFakeTimers();
    escribirDireccion(texto);
    await vi.advanceTimersByTimeAsync(400);
    fixture.detectChanges();
  }

  async function elegirSugerencia(indice = 0): Promise<void> {
    const opciones = raiz().querySelectorAll<HTMLElement>('[role="option"]');
    expect(opciones.length).toBeGreaterThan(indice);
    opciones[indice].click();
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();
    vi.useRealTimers();
  }

  function enviar(): void {
    raiz()
      .querySelector<HTMLFormElement>('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();
  }

  function contador(): string {
    return raiz()
      .querySelector('.solicitud-modal__etiqueta span[aria-label*="ubicaciones"]')
      ?.textContent?.trim() ?? '';
  }

  it('no inicializa Places al abrir el modal y exige comentario y una ubicación', () => {
    expect(lugares.iniciarSesion).not.toHaveBeenCalled();
    expect(lugares.buscar).not.toHaveBeenCalled();

    const confirmar = vi.fn();
    fixture.componentInstance.confirmar.subscribe(confirmar);
    escribirComentario('a'.repeat(20));
    enviar();

    expect(confirmar).not.toHaveBeenCalled();
    expect(contador()).toBe('0/10');
    expect(raiz().textContent).toContain('Agregá al menos una ubicación');
    expect(raiz().querySelector('[role="alert"]')?.textContent).toContain('Revisá los campos marcados');
    expect(raiz().querySelector('#solicitud-direccion')?.getAttribute('aria-invalid')).toBe('true');
  });

  it('no guarda texto libre: solo acepta una sugerencia de Places', async () => {
    const confirmar = vi.fn();
    fixture.componentInstance.confirmar.subscribe(confirmar);

    escribirComentario('Un comentario suficientemente largo para la prueba.');
    escribirDireccion(DIRECCIONES[0]);
    expect(lugares.buscar).not.toHaveBeenCalled();

    enviar();
    expect(confirmar).not.toHaveBeenCalled();

    await buscar(DIRECCIONES[0]);
    expect(lugares.iniciarSesion).toHaveBeenCalledTimes(1);
    expect(lugares.buscar).toHaveBeenCalledWith(DIRECCIONES[0], { token: 1 });

    await elegirSugerencia();
    expect(lugares.obtenerDetalles).toHaveBeenCalledTimes(1);
    expect(contador()).toBe('1/10');
    expect(raiz().textContent).toContain(DIRECCIONES[0]);
  });

  it('envía motivo limpio y las cuatro claves de cada ubicación elegida', async () => {
    const confirmar = vi.fn();
    fixture.componentInstance.confirmar.subscribe(confirmar);

    escribirComentario(`   ${'a'.repeat(20)}   `);
    await buscar(DIRECCIONES[0]);
    await elegirSugerencia();

    enviar();

    expect(confirmar).toHaveBeenCalledTimes(1);
    expect(confirmar).toHaveBeenCalledWith({
      motivo: 'a'.repeat(20),
      ubicaciones: [
        {
          direccion: DIRECCIONES[0],
          latitud: -34.6037,
          longitud: -58.3816,
          googlePlaceId: sugerencia(DIRECCIONES[0]).id,
        },
      ],
    });
  });

  it('permite eliminar ubicaciones y actualiza el contador', async () => {
    await buscar(DIRECCIONES[0]);
    await elegirSugerencia();

    await buscar(DIRECCIONES[1]);
    await elegirSugerencia();

    expect(contador()).toBe('2/10');
    const quitar = raiz().querySelectorAll<HTMLButtonElement>('.solicitud-modal__quitar');
    expect(quitar).toHaveLength(2);
    expect(quitar[0].getAttribute('aria-label')).toContain(DIRECCIONES[0]);

    quitar[0].click();
    fixture.detectChanges();

    expect(contador()).toBe('1/10');
    expect(raiz().textContent).not.toContain(DIRECCIONES[0]);
    expect(raiz().textContent).toContain(DIRECCIONES[1]);
  });

  it('bloquea la ubicación 11 con mensaje visible y sin consultar Places', async () => {
    for (let indice = 1; indice <= 10; indice++) {
      await buscar(`Dirección número ${indice}, CABA`);
      await elegirSugerencia();
    }

    expect(contador()).toBe('10/10');
    expect(raiz().textContent).toContain('Alcanzaste el máximo de 10 ubicaciones');
    expect(raiz().querySelector<HTMLInputElement>('#solicitud-direccion')?.readOnly).toBe(true);

    const consultas = lugares.buscar.mock.calls.length;
    vi.useFakeTimers();
    escribirDireccion('Dirección número 11, CABA');
    await vi.advanceTimersByTimeAsync(400);
    fixture.detectChanges();

    expect(lugares.buscar).toHaveBeenCalledTimes(consultas);
    expect(contador()).toBe('10/10');
  });

  it('no repite la consulta de Place Details para una dirección ya agregada', async () => {
    await buscar(DIRECCIONES[0]);
    await elegirSugerencia();

    await buscar(DIRECCIONES[0]);
    await elegirSugerencia();

    expect(lugares.obtenerDetalles).toHaveBeenCalledTimes(1);
    expect(contador()).toBe('1/10');
    expect(raiz().textContent).toContain('Esa ubicación ya está en la lista.');
  });

  it('navega con el teclado y confirma la sugerencia activa con Enter', async () => {
    await buscar(DIRECCIONES[0]);
    const input = raiz().querySelector<HTMLInputElement>('#solicitud-direccion')!;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    fixture.detectChanges();

    expect(input.getAttribute('aria-activedescendant')).toBe('solicitud-direccion-opcion-0');

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();

    expect(contador()).toBe('1/10');
  });

  it('muestra error inline de Places y permite reintentar', async () => {
    lugares.iniciarSesion.mockRejectedValueOnce(new Error('sin configuración'));
    await buscar(DIRECCIONES[0]);

    expect(raiz().textContent).toContain('Google Places no está disponible');
    expect(raiz().querySelector('#solicitud-direccion')?.getAttribute('aria-invalid')).toBe('true');

    raiz().querySelector<HTMLButtonElement>('.solicitud-modal__reintentar button')?.click();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();

    expect(lugares.iniciarSesion).toHaveBeenCalledTimes(2);
    expect(raiz().querySelectorAll('[role="option"]')).toHaveLength(1);
  });

  it('limpia el error del backend al corregir el comentario', () => {
    const limpiarError = vi.fn();
    fixture.componentInstance.limpiarError.subscribe(limpiarError);
    fixture.componentRef.setInput('error', 'Ya tenés una solicitud pendiente.');
    fixture.detectChanges();

    expect(raiz().querySelector('[role="alert"]')?.textContent).toContain(
      'Ya tenés una solicitud pendiente.',
    );

    escribirComentario('Un comentario suficientemente largo para corregir el error.');
    expect(limpiarError).toHaveBeenCalledTimes(1);
  });

  it('bloquea el cierre y muestra el estado de envío mientras se procesa', () => {
    const cerrar = vi.fn();
    fixture.componentInstance.cerrar.subscribe(cerrar);
    fixture.componentRef.setInput('enviando', true);
    fixture.detectChanges();

    const submit = raiz().querySelector<HTMLButtonElement>('button[type="submit"]');
    const cancelar = raiz().querySelector<HTMLButtonElement>('.solicitud-modal__cancelar');

    expect(submit?.disabled).toBe(true);
    expect(submit?.textContent).toContain('Enviando');
    expect(cancelar?.disabled).toBe(true);
    expect(raiz().querySelector<HTMLTextAreaElement>('#solicitud-motivo')?.readOnly).toBe(true);

    cancelar?.click();
    fixture.detectChanges();
    expect(cerrar).not.toHaveBeenCalled();
  });
});
