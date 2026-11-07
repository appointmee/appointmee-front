import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SolicitudEmpleadorDetalleDTO } from '../../models/solicitud-empleador';
import { authService } from '../../services/auth-service';
import { Solicitudes } from './solicitudes';

const SOLICITUDES = [
  { id: 10, nombreUsuario: 'Ana', apellidoUsuario: 'Pérez', fechaSolicitud: '2026-11-01' },
  { id: 11, nombreUsuario: 'Bruno', apellidoUsuario: 'Gómez', fechaSolicitud: '2026-10-30' },
  { id: 12, nombreUsuario: 'Carla', apellidoUsuario: 'Díaz', fechaSolicitud: '2026-10-28' },
  { id: 13, nombreUsuario: 'Diego', apellidoUsuario: 'Sosa', fechaSolicitud: '2026-10-25' },
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

describe('Solicitudes · empleador', () => {
  let fixture: ComponentFixture<Solicitudes>;
  let backend: HttpTestingController;
  let descriptorShowModal: PropertyDescriptor | undefined;
  const auth = { tieneAlgunRol: vi.fn() };

  beforeEach(async () => {
    vi.resetAllMocks();
    auth.tieneAlgunRol.mockReturnValue(false);
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

    fixture = TestBed.createComponent(Solicitudes);
    fixture.detectChanges();
    backend = TestBed.inject(HttpTestingController);
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

  function listar(): ReturnType<HttpTestingController['expectOne']> {
    return backend.expectOne((request) =>
      request.url.endsWith('/solicitudes-empleador/propias'),
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
      request.url.endsWith('/detalles'),
    );

    expect(solicitudesDetalle).toHaveLength(visibles.length);

    for (const peticion of solicitudesDetalle) {
      const id = Number(
        /\/solicitudes-empleador\/(\d+)\/detalles/.exec(peticion.request.url)?.[1],
      );
      const datos = detalles.get(id);
      if (datos) {
        peticion.flush(datos);
      } else {
        peticion.flush({}, { status: 500, statusText: 'Error' });
      }
    }

    fixture.detectChanges();
  }

  it('muestra las últimas 3 solicitudes con su estado, el acceso al historial y el panel de empleo', () => {
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

    expect(contenido).toContain('En construcción');
    expect(contenido).toContain('Próximamente');
    expect(host.querySelector('.panel--proximamente button')).toBeNull();
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
    expect(host.textContent).toContain('En construcción');

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

    auth.tieneAlgunRol.mockReturnValue(true);
    fixture = TestBed.createComponent(Solicitudes);
    fixture.detectChanges();

    listar().flush([]);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('permisos de administrador o empleador');
    expect(host.querySelector('.boton--principal')).toBeNull();
  });
});
