import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SolicitudEmpleadoDetalleDTO } from '../../models/solicitud-empleado';
import { SolicitudEmpleadorDetalleDTO } from '../../models/solicitud-empleador';
import { authService } from '../../services/auth-service';
import { Solicitudes } from './solicitudes';

const SOLICITUDES = [
  { id: 10, nombreUsuario: 'Ana', apellidoUsuario: 'Pérez', fechaSolicitud: '2026-11-01' },
  { id: 11, nombreUsuario: 'Bruno', apellidoUsuario: 'Gómez', fechaSolicitud: '2026-10-30' },
  { id: 12, nombreUsuario: 'Carla', apellidoUsuario: 'Díaz', fechaSolicitud: '2026-10-28' },
  { id: 13, nombreUsuario: 'Diego', apellidoUsuario: 'Sosa', fechaSolicitud: '2026-10-25' },
];

const RECIBIDAS = [
  { id: 31, nombreSucursal: 'Barbería Central', fechaSolicitud: '2026-11-02' },
  { id: 32, nombreSucursal: 'Estudio Norte', fechaSolicitud: '2026-10-31' },
  { id: 33, nombreSucursal: 'Spa del Río', fechaSolicitud: '2026-10-29' },
  { id: 34, nombreSucursal: 'Peluquería Sur', fechaSolicitud: '2026-10-27' },
];

function detalle(
  id: number,
  estado: SolicitudEmpleadorDetalleDTO['estado'],
  nombre = 'Ana',
  apellido = 'Pérez',
): SolicitudEmpleadorDetalleDTO {
  return {
    id,
    motivo: `Motivo de la solicitud ${id}`,
    estado,
    fechaSolicitud: '2026-11-01',
    usuario: {
      id: 1,
      nombre,
      apellido,
      email: 'ana@example.com',
      urlFotoPerfil: null,
    },
  };
}

function detalleEmpleado(
  id: number,
  estado: SolicitudEmpleadoDetalleDTO['estadoSolicitud'],
  nombreSucursal = 'Barbería Central',
): SolicitudEmpleadoDetalleDTO {
  return {
    id,
    estadoSolicitud: estado,
    fechaSolicitud: '2026-11-02',
    empleado: {
      id: 99,
      nombre: 'Ana',
      apellido: 'Pérez',
      email: 'ana@example.com',
      urlFotoPerfil: null,
    },
    sucursal: {
      id: 5,
      nombre: nombreSucursal,
      categoria: 'BARBERIA',
      fotoPerfil: null,
      puntuacion: 4.5,
      cantidadPuntuaciones: 10,
      diasApertura: ['LUNES'],
    },
  };
}

function idDeDetalle(url: string, recurso: 'empleador' | 'empleado'): number {
  const patron =
    recurso === 'empleador'
      ? /\/solicitudes-empleador\/(\d+)\/detalles/
      : /\/solicitudes-empleado\/(\d+)\/detalles/;

  return Number(patron.exec(url)?.[1]);
}

describe('Solicitudes · empleador y empleo', () => {
  let fixture: ComponentFixture<Solicitudes>;
  let backend: HttpTestingController;
  let descriptorShowModal: PropertyDescriptor | undefined;
  const auth = { tieneAlgunRol: vi.fn<(...roles: string[]) => boolean>() };

  const sinRoles = (): boolean => false;
  const soloCliente = (...roles: string[]): boolean => roles.includes('CLIENTE');
  const soloEmpleador = (...roles: string[]): boolean =>
    roles.includes('ADMINISTRADOR') || roles.includes('EMPLEADOR');

  beforeEach(async () => {
    vi.resetAllMocks();
    auth.tieneAlgunRol.mockImplementation(sinRoles);
    descriptorShowModal = Object.getOwnPropertyDescriptor(
      HTMLDialogElement.prototype,
      'showModal',
    );
    // JSDOM no implementa los métodos del diálogo nativo.
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.setAttribute('open', '');
      },
    });

    await TestBed.configureTestingModule({
      imports: [Solicitudes],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: authService, useValue: auth },
      ],
    }).compileComponents();

    backend = TestBed.inject(HttpTestingController);
    crearComponente();
  });

  afterEach(() => {
    fixture.destroy();
    backend.verify();
    document.body.classList.remove('modal-abierto');

    if (descriptorShowModal) {
      Object.defineProperty(HTMLDialogElement.prototype, 'showModal', descriptorShowModal);
    } else {
      delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).showModal;
    }
  });

  function crearComponente(): void {
    fixture = TestBed.createComponent(Solicitudes);
    fixture.detectChanges();
  }

  function recrearComoCliente(): void {
    listar().flush([]);
    fixture.detectChanges();
    fixture.destroy();

    auth.tieneAlgunRol.mockImplementation(soloCliente);
    crearComponente();
  }

  function listar(): ReturnType<HttpTestingController['expectOne']> {
    return backend.expectOne((request) =>
      request.url.endsWith('/solicitudes-empleador/propias'),
    );
  }

  function listarRecibidas(): ReturnType<HttpTestingController['expectOne']> {
    return backend.expectOne((request) =>
      request.url.endsWith('/solicitudes-empleado/recibidas'),
    );
  }

  function responderLista(
    solicitudes: readonly (typeof SOLICITUDES)[number][],
    detalles: ReadonlyMap<number, SolicitudEmpleadorDetalleDTO> = new Map(),
  ): void {
    listar().flush(solicitudes);
    fixture.detectChanges();

    const visibles = solicitudes.slice(0, 3);
    const solicitudesDetalle = backend.match((request) =>
      /\/solicitudes-empleador\/\d+\/detalles/.test(request.url),
    );

    expect(solicitudesDetalle).toHaveLength(visibles.length);

    for (const peticion of solicitudesDetalle) {
      const id = idDeDetalle(peticion.request.url, 'empleador');
      const datos = detalles.get(id);
      if (datos) {
        peticion.flush(datos);
      } else {
        peticion.flush({}, { status: 500, statusText: 'Error' });
      }
    }

    fixture.detectChanges();
  }

  function responderRecibidas(
    solicitudes: readonly (typeof RECIBIDAS)[number][],
    detalles: ReadonlyMap<number, SolicitudEmpleadoDetalleDTO> = new Map(),
  ): void {
    listarRecibidas().flush(solicitudes);
    fixture.detectChanges();

    const visibles = solicitudes.slice(0, 3);
    const solicitudesDetalle = backend.match((request) =>
      /\/solicitudes-empleado\/\d+\/detalles/.test(request.url),
    );

    expect(solicitudesDetalle).toHaveLength(visibles.length);

    for (const peticion of solicitudesDetalle) {
      const id = idDeDetalle(peticion.request.url, 'empleado');
      const datos = detalles.get(id);
      if (datos) {
        peticion.flush(datos);
      } else {
        peticion.flush({}, { status: 500, statusText: 'Error' });
      }
    }

    fixture.detectChanges();
  }

  function botonPorTexto(texto: string): HTMLButtonElement | undefined {
    const host = fixture.nativeElement as HTMLElement;
    return Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find((boton) =>
      boton.textContent?.includes(texto),
    );
  }

  it('muestra las últimas 3 solicitudes, el acceso al historial y explica el panel de empleo', () => {
    responderLista(
      SOLICITUDES,
      new Map([
        [10, detalle(10, 'APROBADA')],
        [11, detalle(11, 'PENDIENTE', 'Bruno', 'Gómez')],
        [12, detalle(12, 'RECHAZADA', 'Carla', 'Díaz')],
      ]),
    );

    const host = fixture.nativeElement as HTMLElement;
    const contenido = host.textContent ?? '';

    expect(host.querySelectorAll('app-solicitud-empleador-card')).toHaveLength(3);
    expect(contenido).toContain('Ana Pérez');
    expect(contenido).toContain('Aprobada');
    expect(contenido).toContain('Pendiente');
    expect(contenido).toContain('Rechazada');
    expect(host.querySelector('.panel__contador')?.textContent?.trim()).toBe('4');

    const verMas = host.querySelector<HTMLAnchorElement>('.ver-mas');
    expect(verMas?.textContent).toContain('Ver más solicitudes');
    expect(verMas?.getAttribute('href')).toBe('/solicitudes/todas');

    expect(contenido).toContain('Invitaciones de empleo');
    expect(contenido).toContain('cuentas de cliente');
    expect(contenido).not.toContain('En construcción');
    expect(contenido).not.toContain('Próximamente');
    expect(host.querySelector('app-solicitud-empleado-lista')).toBeNull();
    expect(backend.match((request) => request.url.endsWith('/recibidas'))).toHaveLength(0);
  });

  it('para un cliente muestra las últimas 3 invitaciones, su estado y el acceso al historial', () => {
    recrearComoCliente();

    responderLista([]);
    responderRecibidas(
      RECIBIDAS,
      new Map([
        [31, detalleEmpleado(31, 'PENDIENTE', 'Barbería Central')],
        [32, detalleEmpleado(32, 'APROBADA', 'Estudio Norte')],
        [33, detalleEmpleado(33, 'RECHAZADA', 'Spa del Río')],
      ]),
    );

    const host = fixture.nativeElement as HTMLElement;
    const contenido = host.textContent ?? '';

    expect(host.querySelectorAll('app-solicitud-empleado-card')).toHaveLength(3);
    expect(contenido).toContain('Barbería Central');
    expect(contenido).toContain('Estudio Norte');
    expect(contenido).toContain('Spa del Río');
    expect(contenido).toContain('Pendiente');
    expect(contenido).toContain('Aprobada');
    expect(contenido).toContain('Rechazada');

    const verMas = Array.from(host.querySelectorAll<HTMLAnchorElement>('.ver-mas')).find(
      (enlace) => enlace.getAttribute('href') === '/solicitudes/empleo/recibidas',
    );
    expect(verMas?.textContent).toContain('Ver más solicitudes');
  });

  it('permite aprobar una invitación pendiente y actualiza el estado visible', () => {
    recrearComoCliente();

    responderLista([]);
    responderRecibidas(
      [RECIBIDAS[0]],
      new Map([[31, detalleEmpleado(31, 'PENDIENTE')]]),
    );

    const host = fixture.nativeElement as HTMLElement;
    host.querySelector<HTMLButtonElement>('.solicitud__alternar')?.click();
    fixture.detectChanges();

    const aprobar = botonPorTexto('Aprobar invitación');
    expect(aprobar).toBeDefined();
    aprobar?.click();
    fixture.detectChanges();

    const resolucion = backend.expectOne((request) =>
      request.url.endsWith('/solicitudes-empleado/31/aprobar'),
    );
    expect(resolucion.request.method).toBe('PATCH');

    resolucion.flush('Se aceptó la solicitud');
    fixture.detectChanges();

    expect(host.textContent).toContain(
      'Aceptaste la invitación de empleo. Ya formás parte del equipo de la sucursal.',
    );
    expect(host.textContent).toContain('Aprobada');
    expect(botonPorTexto('Aprobar invitación')).toBeUndefined();
  });

  it('ante un error de invitaciones recibidas muestra el error inline y permite reintentar', () => {
    recrearComoCliente();

    responderLista([]);
    listarRecibidas().flush({}, { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('No pudimos cargar tus solicitudes de empleo');

    host.querySelector<HTMLButtonElement>('.estado--error .boton')?.click();
    fixture.detectChanges();

    listarRecibidas().flush([]);
    fixture.detectChanges();

    expect(host.textContent).toContain('Todavía no recibiste invitaciones');
    expect(host.querySelector('.estado--error')).toBeNull();
  });

  it('abre el modal, valida el mínimo y no duplica el envío', () => {
    responderLista([]);

    const host = fixture.nativeElement as HTMLElement;
    const abrir = host.querySelector<HTMLButtonElement>('.boton--principal');
    expect(abrir?.textContent).toContain('Convertirme en empleador');

    abrir?.click();
    fixture.detectChanges();

    const form = host.querySelector<HTMLFormElement>('.solicitud-modal__form');
    const textarea = host.querySelector<HTMLTextAreaElement>('#solicitud-motivo');
    expect(form).not.toBeNull();
    expect(textarea).not.toBeNull();

    textarea!.value = `   ${'a'.repeat(19)}   `;
    textarea!.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();

    expect(host.textContent).toContain('al menos 20 caracteres');
    expect(() =>
      backend.expectOne((request) => request.url.endsWith('/solicitar')),
    ).toThrow();

    textarea!.value = `   ${'a'.repeat(30)}   `;
    textarea!.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();

    form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();

    const envio = backend.expectOne((request) => request.url.endsWith('/solicitar'));
    expect(envio.request.method).toBe('POST');
    expect(envio.request.body).toEqual({ motivo: 'a'.repeat(30) });
    envio.flush('Se registró tu solicitud');

    fixture.detectChanges();
    responderLista([SOLICITUDES[0]], new Map([[10, detalle(10, 'PENDIENTE')]]));

    expect(host.querySelector('.solicitud-modal')).toBeNull();
    expect(host.textContent).toContain('Tu solicitud se envió correctamente');
  });

  it('si el backend rechaza el envío conserva el modal y muestra el mensaje inline', () => {
    responderLista([]);

    const host = fixture.nativeElement as HTMLElement;
    host.querySelector<HTMLButtonElement>('.boton--principal')?.click();
    fixture.detectChanges();

    const form = host.querySelector<HTMLFormElement>('.solicitud-modal__form')!;
    const textarea = host.querySelector<HTMLTextAreaElement>('#solicitud-motivo')!;
    textarea.value = 'Quiero gestionar los turnos de mi negocio.';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();

    backend
      .expectOne((request) => request.url.endsWith('/solicitar'))
      .flush('Ya tenes una solicitud pendiente', { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();

    expect(host.querySelector('.solicitud-modal')).not.toBeNull();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      'Ya tenes una solicitud pendiente',
    );

    textarea.value = 'Quiero gestionar los turnos de mi negocio y mi equipo.';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();

    expect(host.querySelector('.solicitud-modal__error')).toBeNull();
  });

  it('ante un error de listado muestra el error inline y permite reintentar', () => {
    backend
      .expectOne((request) => request.url.endsWith('/solicitudes-empleador/propias'))
      .flush({}, { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('No pudimos cargar tus solicitudes');
    expect(host.textContent).toContain('Invitaciones de empleo');

    host.querySelector<HTMLButtonElement>('.estado--error .boton')?.click();
    fixture.detectChanges();

    listar().flush([]);
    fixture.detectChanges();

    expect(host.textContent).toContain('Todavía no enviaste solicitudes');
    expect(host.querySelector('.estado--error')).toBeNull();
  });

  it('con una solicitud pendiente deshabilita el acceso para volver a solicitar', () => {
    responderLista([SOLICITUDES[0]], new Map([[10, detalle(10, 'PENDIENTE')]]));

    const host = fixture.nativeElement as HTMLElement;
    const boton = host.querySelector<HTMLButtonElement>('.boton--principal');

    expect(boton?.disabled).toBe(true);
    expect(host.textContent).toContain('Ya tenés una solicitud pendiente de revisión');
  });

  it('explica que un administrador o empleador no necesita enviar la solicitud', () => {
    responderLista([]);
    fixture.destroy();

    auth.tieneAlgunRol.mockImplementation(soloEmpleador);
    crearComponente();

    listar().flush([]);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('permisos de administrador o empleador');
    expect(host.querySelector('.boton--principal')).toBeNull();
    expect(host.textContent).toContain('cuentas de cliente');
  });
});
