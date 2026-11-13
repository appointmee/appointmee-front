import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { MisTurnos } from './mis-turnos';

const TURNOS = [
  {
    id: 1,
    nombreServicio: 'Corte de pelo',
    fechaTurno: '2026-11-10T09:00:00',
    estadoTurno: 'PENDIENTE',
    puntuacion: null,
  },
  {
    id: 2,
    nombreServicio: 'Color completo',
    fechaTurno: '2026-11-14T17:30:00',
    estadoTurno: 'CANCELADO',
    puntuacion: null,
  },
  {
    id: 3,
    nombreServicio: 'Arreglo de barba',
    fechaTurno: '2026-11-12T11:15:00',
    estadoTurno: 'REALIZADO',
    puntuacion: null,
  },
] as const;

const DETALLE = {
  fechaReserva: '2026-11-05T10:12:00',
  fechaHora: '2026-11-12T23:30:00',
  estadoTurno: 'CONFIRMADO',
  empleado: { nombre: 'Ana', apellido: 'Pérez' },
  servicio: { id: 5, nombre: 'Corte de pelo', precio: '12500.00', duracion: 45 },
  cliente: { nombre: 'Luis', apellido: 'Gómez' },
  resenia: null,
} as const;

const DETALLE_PENDIENTE = {
  ...DETALLE,
  estadoTurno: 'PENDIENTE',
} as const;

const DETALLE_REALIZADO = {
  ...DETALLE,
  estadoTurno: 'REALIZADO',
} as const;

const RESENIA = {
  puntuacion: 5,
  comentario: 'Excelente atención',
  fechaResenia: '2026-11-12T12:00:00',
} as const;

const DETALLE_RESENIADO = {
  ...DETALLE_REALIZADO,
  resenia: RESENIA,
} as const;

const SERVICIO = {
  id: 5,
  nombre: 'Corte de pelo',
  nombreSucursal: 'Sucursal Centro',
  direccionSucursal: 'Av. Siempre Viva 123',
  categoriaSucursal: 'PELUQUERIA',
};

const SUCURSAL = {
  id: 7,
  nombre: 'Sucursal Centro',
  categoria: 'PELUQUERIA',
  fotoPerfil: 'https://example.com/sucursal.jpg',
  puntuacion: 4.5,
  cantidadPuntuaciones: 12,
};

const SERVICIOS_SUCURSAL = [
  { id: 5, nombre: 'Corte de pelo', precio: 12500, duracion: 45 },
  { id: 9, nombre: 'Color', precio: 18000, duracion: 90 },
];

describe('Mis Turnos', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<MisTurnos>>;
  let backend: HttpTestingController;
  let html: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MisTurnos],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(MisTurnos);
    fixture.detectChanges();
    html = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => {
    fixture.destroy();
    backend.verify();
  });

  function flushLista(turnos: readonly unknown[] = TURNOS): void {
    backend.expectOne((request) => request.url.endsWith('/turnos/propios')).flush(turnos);
    fixture.detectChanges();
  }

  function botonesTurno(): HTMLButtonElement[] {
    return Array.from(html.querySelectorAll<HTMLButtonElement>('button.turno'));
  }

  async function abrirDetalleDe(
    nombreServicio: string,
    id: number,
    detalle: object = DETALLE,
  ): Promise<void> {
    const boton = botonesTurno().find((elemento) =>
      elemento.getAttribute('aria-label')?.includes(nombreServicio),
    );
    expect(boton).toBeTruthy();
    boton!.click();
    fixture.detectChanges();

    backend
      .expectOne((request) => request.url.endsWith(`/turnos/propios/detalles/${id}`))
      .flush(detalle);
    fixture.detectChanges();

    backend
      .expectOne((request) => request.url.endsWith('/servicios/5'))
      .flush(SERVICIO);
    fixture.detectChanges();

    backend
      .expectOne((request) => request.url.endsWith('/sucursales/listar/filtrar'))
      .flush([SUCURSAL]);
    fixture.detectChanges();

    backend
      .expectOne((request) => request.url.endsWith('/servicios/listar/sucursal/7'))
      .flush(SERVICIOS_SUCURSAL);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function abrirDetalle(id = 1): Promise<void> {
    await abrirDetalleDe('Corte de pelo', id);
  }

  function botonPorTexto(texto: string, scope: ParentNode = html): HTMLButtonElement {
    const boton = Array.from(scope.querySelectorAll<HTMLButtonElement>('button')).find(
      (elemento) => elemento.textContent?.includes(texto),
    );
    expect(boton).toBeTruthy();
    return boton!;
  }

  function dialogo(): HTMLElement {
    return html.querySelector('[role="dialog"]') as HTMLElement;
  }

  async function abrirModalResenia(): Promise<HTMLElement> {
    await abrirDetalleDe('Arreglo de barba', 3, DETALLE_REALIZADO);
    const resenar = botonPorTexto('Reseñar', dialogo());
    expect(resenar.disabled).toBe(false);
    resenar.click();
    fixture.detectChanges();
    await fixture.whenStable();
    return dialogo();
  }

  function seleccionarAbeja(valor: number): void {
    const radio = html.querySelector<HTMLInputElement>(
      `input[name="resenia-puntuacion"][value="${valor}"]`,
    );
    expect(radio).toBeTruthy();
    radio!.checked = true;
    radio!.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  function escribirComentario(texto: string): void {
    const textarea = html.querySelector<HTMLTextAreaElement>('#resenia-comentario');
    expect(textarea).toBeTruthy();
    textarea!.value = texto;
    textarea!.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  async function abrirConfirmacionPublicacion(
    puntuacion = 4,
    comentario = '',
  ): Promise<HTMLElement> {
    seleccionarAbeja(puntuacion);
    if (comentario) escribirComentario(comentario);
    botonPorTexto('Confirmar reseña', dialogo()).click();
    fixture.detectChanges();
    await fixture.whenStable();
    return dialogo();
  }

  it('carga todos los turnos y los ordena del más reciente al más antiguo', () => {
    expect(html.textContent).toContain('Cargando tus turnos');
    flushLista();

    const botones = botonesTurno();
    expect(botones).toHaveLength(3);
    expect(botones[0].textContent).toContain('Color completo');
    expect(botones[1].textContent).toContain('Arreglo de barba');
    expect(botones[2].textContent).toContain('Corte de pelo');

    expect(html.textContent).toContain('Pendiente');
    expect(html.textContent).toContain('Cancelado');
    expect(html.textContent).toContain('Realizado');
    expect(html.querySelector('.panel__contador')?.textContent?.trim()).toBe('3');
  });

  it('filtra por estado y permite volver a ver todos', () => {
    flushLista();
    const select = html.querySelector('select') as HTMLSelectElement;

    select.value = 'CANCELADO';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(botonesTurno()).toHaveLength(1);
    expect(botonesTurno()[0].textContent).toContain('Color completo');

    select.value = 'PAGO_RECHAZADO';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(html.textContent).toContain('No tenés turnos con ese estado');

    const verTodos = Array.from(html.querySelectorAll('button')).find((boton) =>
      boton.textContent?.includes('Ver todos los turnos'),
    ) as HTMLButtonElement;
    verTodos.click();
    fixture.detectChanges();
    expect(botonesTurno()).toHaveLength(3);
  });

  it('muestra el estado vacío cuando el cliente todavía no tiene turnos', () => {
    flushLista([]);
    expect(html.textContent).toContain('Todavía no tenés turnos');
    expect(html.querySelector('a[href="/sucursales"]')).not.toBeNull();
  });

  it('muestra un error inline y permite reintentar la carga', () => {
    backend
      .expectOne((request) => request.url.endsWith('/turnos/propios'))
      .flush(null, { status: 500, statusText: 'Error' });
    fixture.detectChanges();

    const alerta = html.querySelector('[role="alert"]');
    expect(alerta?.textContent).toContain('No pudimos cargar tus turnos');

    const reintentar = Array.from(html.querySelectorAll('button')).find((boton) =>
      boton.textContent?.includes('Reintentar'),
    ) as HTMLButtonElement;
    reintentar.click();
    fixture.detectChanges();
    expect(reintentar.disabled).toBe(true);
    expect(reintentar.getAttribute('aria-busy')).toBe('true');

    flushLista();
    expect(botonesTurno()).toHaveLength(3);
    expect(html.querySelector('[role="alert"]')).toBeNull();
  });

  it('abre el detalle con sucursal, servicio, personas, fechas y estado', async () => {
    flushLista();
    await abrirDetalle();

    const dialogo = html.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialogo).not.toBeNull();
    expect(dialogo.getAttribute('aria-labelledby')).toBe('detalle-turno-titulo');
    expect(dialogo.textContent).toContain('Sucursal Centro');
    expect(dialogo.textContent).toContain('Corte de pelo');
    expect(dialogo.textContent).toContain('12.500');
    expect(dialogo.textContent).toContain('45 min');
    expect(dialogo.textContent).toContain('Ana Pérez');
    expect(dialogo.textContent).toContain('Luis Gómez');
    expect(dialogo.textContent).toContain('05/11/2026');
    expect(dialogo.textContent).toContain('12/11/2026 · 23:30');
    expect(dialogo.textContent).toContain('13/11/2026 · 00:15');
    expect(dialogo.textContent).toContain('4.5 de 5');
    expect(dialogo.textContent).toContain('12 reseñas');
    expect(dialogo.querySelector('a[href="/sucursal/7"]')?.textContent).toContain(
      'Ver sucursal',
    );

    const resenar = Array.from(dialogo.querySelectorAll('button')).find((boton) =>
      boton.textContent?.trim() === 'Reseñar',
    ) as HTMLButtonElement;
    expect(resenar).toBeTruthy();
    expect(resenar.disabled).toBe(true);
  });

  it('muestra el error del detalle y permite reintentarlo', async () => {
    flushLista();
    const boton = botonesTurno()[2];
    boton.click();
    fixture.detectChanges();

    backend
      .expectOne((request) => request.url.endsWith('/turnos/propios/detalles/1'))
      .flush(null, { status: 500, statusText: 'Error' });
    fixture.detectChanges();
    expect(html.querySelector('[role="dialog"]')?.textContent).toContain(
      'No pudimos cargar el detalle',
    );

    const reintentar = Array.from(
      html.querySelectorAll<HTMLButtonElement>('[role="dialog"] button'),
    ).find((elemento) => elemento.textContent?.includes('Reintentar'));
    expect(reintentar).toBeTruthy();
    reintentar!.click();
    fixture.detectChanges();

    backend
      .expectOne((request) => request.url.endsWith('/turnos/propios/detalles/1'))
      .flush(DETALLE);
    fixture.detectChanges();
    backend
      .expectOne((request) => request.url.endsWith('/servicios/5'))
      .flush(SERVICIO);
    fixture.detectChanges();
    backend
      .expectOne((request) => request.url.endsWith('/sucursales/listar/filtrar'))
      .flush([SUCURSAL]);
    fixture.detectChanges();
    backend
      .expectOne((request) => request.url.endsWith('/servicios/listar/sucursal/7'))
      .flush(SERVICIOS_SUCURSAL);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(html.querySelector('[role="dialog"]')?.textContent).toContain('Ana Pérez');
  });

  it('cierra el detalle con el botón visible y con Escape', async () => {
    flushLista();
    await abrirDetalle();

    const cerrar = html.querySelector(
      '.detalle__cerrar',
    ) as HTMLButtonElement;
    expect(cerrar.getAttribute('aria-label')).toBe('Cerrar detalle del turno');
    cerrar.click();
    fixture.detectChanges();
    expect(html.querySelector('[role="dialog"]')).toBeNull();

    await abrirDetalle();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(html.querySelector('[role="dialog"]')).toBeNull();
  });

  it('abre el modal de reseña con cinco abejas accesibles y puntuación obligatoria', async () => {
    flushLista();
    const modal = await abrirModalResenia();

    expect(modal.getAttribute('aria-labelledby')).toBe('resenar-turno-titulo');
    expect(modal.querySelector('h2')?.textContent?.trim()).toBe('Reseñar turno');

    const radios = Array.from(
      modal.querySelectorAll<HTMLInputElement>('input[name="resenia-puntuacion"]'),
    );
    expect(radios).toHaveLength(5);
    expect(radios.map((radio) => radio.type)).toEqual(Array(5).fill('radio'));
    expect(radios.map((radio) => radio.value)).toEqual(['1', '2', '3', '4', '5']);
    expect(radios[0].getAttribute('aria-describedby')).toContain(
      'resenia-puntuacion-ayuda',
    );
    expect(radios[0].closest('label')?.textContent).toContain('1 abeja');
    expect(modal.textContent).toContain('1 abeja');
    expect(modal.textContent).toContain('5 abejas');
    expect(modal.querySelector('legend')?.textContent).toContain('Puntuación');
    expect(modal.querySelector('legend')?.textContent).toContain('obligatoria');

    const textarea = modal.querySelector<HTMLTextAreaElement>('#resenia-comentario');
    expect(textarea?.getAttribute('maxlength')).toBe('400');
    expect(modal.textContent).toContain('Mínimo 9 caracteres');
    expect(modal.textContent).toContain('0 / 400');

    botonPorTexto('Confirmar reseña', modal).click();
    fixture.detectChanges();

    expect(modal.querySelector('.resenia__puntuacion')?.getAttribute('aria-invalid')).toBe(
      'true',
    );
    expect(modal.textContent).toContain('Elegí una puntuación de 1 a 5 abejas.');
    expect(document.activeElement).toBe(radios[0]);
    expect(dialogo()).toBe(modal);
  });

  it('valida el comentario opcional y conserva los valores al volver desde la confirmación', async () => {
    flushLista();
    await abrirModalResenia();

    seleccionarAbeja(4);
    escribirComentario('Corto');
    botonPorTexto('Confirmar reseña').click();
    fixture.detectChanges();

    expect(html.textContent).toContain('al menos 9 caracteres');
    expect(
      dialogo().querySelector<HTMLTextAreaElement>('#resenia-comentario')?.value,
    ).toBe('Corto');

    escribirComentario('Excelente atención');
    expect(html.textContent).toContain('18 / 400');
    botonPorTexto('Confirmar reseña').click();
    fixture.detectChanges();
    await fixture.whenStable();

    const confirmacion = dialogo();
    expect(confirmacion.getAttribute('aria-labelledby')).toBe('confirmar-resenia-titulo');
    expect(confirmacion.textContent).toContain('¿Publicar tu reseña?');
    expect(confirmacion.textContent).toContain('Excelente atención');
    expect(
      confirmacion.querySelector('.confirmacion__abejas')?.getAttribute('aria-label'),
    ).toBe('4 de 5 abejas');

    botonPorTexto('Volver atrás', confirmacion).click();
    fixture.detectChanges();
    await fixture.whenStable();

    const formulario = dialogo();
    expect(formulario.getAttribute('aria-labelledby')).toBe('resenar-turno-titulo');
    expect(
      formulario.querySelector<HTMLInputElement>('input[value="4"]')?.checked,
    ).toBe(true);
    expect(
      formulario.querySelector<HTMLTextAreaElement>('#resenia-comentario')?.value,
    ).toBe('Excelente atención');
  });

  it('publica la reseña, cierra los modales y marca el turno como reseñado', async () => {
    flushLista();
    await abrirModalResenia();
    const confirmacion = await abrirConfirmacionPublicacion(5);

    botonPorTexto('Confirmar publicación', confirmacion).click();
    const peticion = backend.expectOne(
      (request) =>
        request.url.endsWith('/turnos/3/resenia') && request.method === 'POST',
    );
    expect(peticion.request.body).toEqual({ puntuacion: 5, comentario: null });
    peticion.flush('Reseña guardada correctamente');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(html.querySelector('[role="dialog"]')).toBeNull();
    expect(html.querySelector('.aviso--exito')?.textContent).toContain(
      'Reseña guardada correctamente',
    );

    const turno = botonesTurno().find((boton) =>
      boton.textContent?.includes('Arreglo de barba'),
    );
    expect(turno?.textContent).toContain('Reseñado');
    expect(turno?.getAttribute('aria-label')).toContain('reseñado');

    await abrirDetalleDe('Arreglo de barba', 3, DETALLE_RESENIADO);
    const detalle = dialogo();
    expect(detalle.textContent).toContain('Reseña publicada');
    expect(detalle.textContent).toContain('Excelente atención');
    expect(
      Array.from(detalle.querySelectorAll('button')).some(
        (boton) => boton.textContent?.trim() === 'Reseñar',
      ),
    ).toBe(false);
  });

  it('muestra un turno ya reseñado y evita publicar una segunda reseña', async () => {
    flushLista([{ ...TURNOS[2], puntuacion: 5 }]);
    const turno = botonesTurno().find((boton) =>
      boton.textContent?.includes('Arreglo de barba'),
    );
    expect(turno?.textContent).toContain('Reseñado');

    await abrirDetalleDe('Arreglo de barba', 3, DETALLE_RESENIADO);
    const detalle = dialogo();
    expect(detalle.textContent).toContain('Reseña publicada');
    expect(
      Array.from(detalle.querySelectorAll('button')).some(
        (boton) => boton.textContent?.trim() === 'Reseñar',
      ),
    ).toBe(false);
  });

  it('mantiene la confirmación abierta ante un error de red y permite reintentar', async () => {
    flushLista();
    await abrirModalResenia();
    const confirmacion = await abrirConfirmacionPublicacion(3, 'Muy buena experiencia');

    botonPorTexto('Confirmar publicación', confirmacion).click();
    const primera = backend.expectOne((request) =>
      request.url.endsWith('/turnos/3/resenia'),
    );
    primera.flush(null, { status: 0, statusText: 'Error de red' });
    fixture.detectChanges();
    await fixture.whenStable();

    const conError = dialogo();
    expect(conError.getAttribute('aria-labelledby')).toBe('confirmar-resenia-titulo');
    expect(conError.textContent).toContain('No pudimos conectarnos');
    expect(conError.textContent).toContain('Tus datos siguen cargados');
    expect(botonPorTexto('Volver atrás', conError).disabled).toBe(false);

    botonPorTexto('Confirmar publicación', conError).click();
    const segunda = backend.expectOne((request) =>
      request.url.endsWith('/turnos/3/resenia'),
    );
    expect(segunda.request.body).toEqual({
      puntuacion: 3,
      comentario: 'Muy buena experiencia',
    });
    segunda.flush('Reseña guardada correctamente');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(html.querySelector('[role="dialog"]')).toBeNull();
    expect(html.querySelector('.aviso--exito')?.textContent).toContain(
      'Reseña guardada correctamente',
    );
  });

  it('muestra el error del servidor y conserva los datos al volver al formulario', async () => {
    flushLista();
    await abrirModalResenia();
    const confirmacion = await abrirConfirmacionPublicacion(5, 'Una experiencia genial');

    botonPorTexto('Confirmar publicación', confirmacion).click();
    backend
      .expectOne((request) => request.url.endsWith('/turnos/3/resenia'))
      .flush('No se pudo guardar la reseña', { status: 500, statusText: 'Error' });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(dialogo().textContent).toContain('No se pudo guardar la reseña');

    botonPorTexto('Volver atrás', dialogo()).click();
    fixture.detectChanges();
    await fixture.whenStable();

    const formulario = dialogo();
    expect(
      formulario.querySelector<HTMLInputElement>('input[value="5"]')?.checked,
    ).toBe(true);
    expect(
      formulario.querySelector<HTMLTextAreaElement>('#resenia-comentario')?.value,
    ).toBe('Una experiencia genial');
  });

  it('bloquea envíos duplicados mientras publica la reseña', async () => {
    flushLista();
    await abrirModalResenia();
    const confirmacion = await abrirConfirmacionPublicacion(4);

    botonPorTexto('Confirmar publicación', confirmacion).click();
    fixture.detectChanges();

    const peticion = backend.expectOne(
      (request) =>
        request.url.endsWith('/turnos/3/resenia') && request.method === 'POST',
    );
    const publicando = botonPorTexto('Publicando', dialogo());
    expect(publicando.disabled).toBe(true);
    expect(publicando.getAttribute('aria-busy')).toBe('true');

    publicando.click();
    fixture.detectChanges();
    peticion.flush('Reseña guardada correctamente');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(html.querySelector('[role="dialog"]')).toBeNull();
  });

  it('cancela la reseña y vuelve al listado sin publicar', async () => {
    flushLista();
    await abrirModalResenia();

    seleccionarAbeja(2);
    escribirComentario('Comentario de prueba');
    botonPorTexto('Cancelar', dialogo()).click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(html.querySelector('[role="dialog"]')).toBeNull();
    expect(html.textContent).toContain('Todos tus turnos');
  });

  it('muestra el botón Pagar solo en el detalle de un turno pendiente', async () => {
    flushLista();
    await abrirDetalleDe('Corte de pelo', 1, DETALLE_PENDIENTE);

    const modal = dialogo();
    const pagar = Array.from(modal.querySelectorAll('button')).find(
      (boton) => boton.textContent?.trim() === 'Pagar',
    ) as HTMLButtonElement | undefined;
    expect(pagar).toBeTruthy();
    expect(pagar!.disabled).toBe(false);
    expect(modal.textContent).toContain('Pago pendiente');
  });

  it('no muestra el botón Pagar en turnos con estado distinto de pendiente', async () => {
    flushLista();
    await abrirDetalleDe('Corte de pelo', 1, DETALLE);

    const modal = dialogo();
    expect(
      Array.from(modal.querySelectorAll('button')).some(
        (boton) => boton.textContent?.trim() === 'Pagar',
      ),
    ).toBe(false);
  });

  it('permite pagar un turno pendiente y actualiza solo su detalle cuando se confirma', async () => {
    vi.useFakeTimers();
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const setTimeoutSpy = vi
      .spyOn(window, 'setTimeout')
      .mockImplementation(((handler: TimerHandler) => {
        if (typeof handler === 'function') {
          queueMicrotask(() => handler());
        }
        return 1 as unknown as ReturnType<typeof setTimeout>;
      }) as typeof setTimeout);
    try {
      flushLista();
      await abrirDetalleDe('Corte de pelo', 1, DETALLE_PENDIENTE);

      botonPorTexto('Pagar', dialogo()).click();
      fixture.detectChanges();

      const pagoReq = backend.expectOne(
        (request) => request.url.endsWith('/pagos/1') && request.method === 'POST',
      );
      pagoReq.flush('https://mp.test/pago/1');
      await Promise.resolve();
      await Promise.resolve();
      fixture.detectChanges();

      expect(openSpy).toHaveBeenCalledWith(
        'https://mp.test/pago/1',
        '_blank',
        'noopener,noreferrer',
      );

      await Promise.resolve();
      fixture.detectChanges();

      const seguimiento = backend.expectOne(
        (request) =>
          request.url.endsWith('/turnos/propios/detalles/1') && request.method === 'GET',
      );
      seguimiento.flush({ ...DETALLE_PENDIENTE, estadoTurno: 'CONFIRMADO' });
      fixture.detectChanges();
      await Promise.resolve();
      fixture.detectChanges();

      expect(dialogo().textContent).toContain('Confirmado');
      expect(
        Array.from(dialogo().querySelectorAll('button')).some(
          (boton) => boton.textContent?.trim() === 'Pagar',
        ),
      ).toBe(false);

      const turno = botonesTurno().find((boton) =>
        boton.textContent?.includes('Corte de pelo'),
      );
      expect(turno?.textContent).toContain('Confirmado');
      backend.expectNone((request) => request.url.endsWith('/turnos/propios'));
    } finally {
      setTimeoutSpy.mockRestore();
      openSpy.mockRestore();
      vi.useRealTimers();
    }
  });
});
