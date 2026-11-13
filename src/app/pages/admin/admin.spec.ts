import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, Input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SolicitudEmpleadorDetalleDTO } from '../../models/solicitud-empleador';
import { Administracion } from './admin';
import { Graficos } from '../graficos/graficos';

@Component({
  selector: 'app-graficos',
  standalone: true,
  template: '<p class="graficos-integrados">Estadísticas de administración cargadas</p>',
})
class GraficosIntegradosStub {
  @Input() incrustado = false;
}

const SOLICITUDES = [
  { id: 31, nombreUsuario: 'Ana', apellidoUsuario: 'Pérez', fechaSolicitud: '2026-11-01' },
  { id: 32, nombreUsuario: 'Bruno', apellidoUsuario: 'Gómez', fechaSolicitud: '2026-10-30' },
];

const SUCURSALES = [
  { id: 41, nombre: 'Centro', categoria: 'BARBERIA', fotoPerfil: null, puntuacion: 4.5, cantidadPuntuaciones: 2 },
  { id: 42, nombre: 'Norte', categoria: 'SPA', fotoPerfil: null, puntuacion: null, cantidadPuntuaciones: 0 },
];

const USUARIOS = [
  { id: 71, nombre: 'Lucía', apellido: 'García', estado: true, fotoPerfil: 'https://res.cloudinary.com/example/lucia.jpg' },
  { id: 72, nombre: 'Mario', apellido: 'Paz', estado: false, fotoPerfil: null },
];

function detalle(
  id: number,
  estado: SolicitudEmpleadorDetalleDTO['estado'],
): SolicitudEmpleadorDetalleDTO {
  return {
    id,
    motivo: `Motivo de la solicitud ${id}`,
    estado,
    fechaSolicitud: '2026-11-01',
    // El backend devuelve el usuario que consulta; el panel debe priorizar al solicitante del listado.
    usuario: {
      id: 99,
      nombre: 'Admin',
      apellido: 'Root',
      email: 'admin@example.com',
      urlFotoPerfil: null,
    },
  };
}

describe('Administración · solicitudes de empleador', () => {
  let fixture: ComponentFixture<Administracion>;
  let backend: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [Administracion],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    TestBed.overrideComponent(Administracion, {
      remove: { imports: [Graficos] },
      add: { imports: [GraficosIntegradosStub] },
    });
    await TestBed.compileComponents();

    fixture = TestBed.createComponent(Administracion);
    fixture.detectChanges();
    backend = TestBed.inject(HttpTestingController);
    backend.expectOne((request) => request.url.endsWith('/usuarios/listar')).flush(USUARIOS);
    backend.expectOne((request) => request.url.endsWith('/sucursales/listar')).flush(SUCURSALES);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    backend.verify();
  });

  function listar(): ReturnType<HttpTestingController['expectOne']> {
    return backend.expectOne((request) =>
      request.url.endsWith('/solicitudes-empleador/listar'),
    );
  }

  function peticionDetalle(): ReturnType<HttpTestingController['expectOne']> {
    return backend.expectOne((request) => request.url.endsWith('/detalles'));
  }

  function alternar(indice = 0): void {
    const host = fixture.nativeElement as HTMLElement;
    const boton = host.querySelectorAll<HTMLButtonElement>('.solicitud__alternar')[indice];
    boton?.click();
    fixture.detectChanges();
  }

  it('lista pendientes con los datos del solicitante y resuelve solo después de cargar el detalle', () => {
    listar().flush(SOLICITUDES);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelectorAll('app-solicitud-empleador-card')).toHaveLength(2);
    expect(host.querySelector('.panel__contador')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      '2 pendientes',
    );
    expect(host.textContent).toContain('Ana Pérez');
    expect(host.textContent).toContain('Pendiente');
    expect(host.querySelector('.solicitud__accion')).toBeNull();
    expect(backend.match((request) => request.url.endsWith('/detalles'))).toHaveLength(0);

    alternar();

    peticionDetalle().flush(detalle(31, 'PENDIENTE'));
    fixture.detectChanges();

    expect(host.textContent).toContain('Motivo de la solicitud 31');
    expect(host.textContent).toContain('Ana Pérez');
    expect(host.textContent).not.toContain('Admin Root');
    expect(host.querySelector('.solicitud__accion--aprobar')?.textContent).toContain(
      'Aprobar solicitud',
    );
    expect(host.querySelector('.solicitud__accion--rechazar')?.textContent).toContain('Rechazar');
  });

  it('muestra sucursales globales y permite localizarlas por nombre, categoría o número', () => {
    listar().flush([]);
    const host = fixture.nativeElement as HTMLElement;
    host.querySelector<HTMLButtonElement>('.admin__seccion[aria-controls="sucursales-admin-panel"]')?.click();
    fixture.detectChanges();
    expect(host.textContent).toContain('2 activas');
    expect(host.textContent).toContain('Centro');
    expect(host.querySelector<HTMLButtonElement>('.sucursal-admin button')?.textContent).toContain('Ver detalle');

    const busqueda = host.querySelector<HTMLInputElement>('input[type="search"]');
    busqueda!.value = 'spa';
    busqueda!.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(host.querySelectorAll('.sucursal-admin')).toHaveLength(1);
    expect(host.textContent).toContain('Norte');
    expect(host.textContent).not.toContain('Centro');

    busqueda!.value = '999';
    busqueda!.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(host.textContent).toContain('No encontramos sucursales');
  });

  it('muestra el detalle completo en modo administrador y da de baja la sucursal con confirmación', () => {
    listar().flush([]);
    const host = fixture.nativeElement as HTMLElement;
    host.querySelector<HTMLButtonElement>('.admin__seccion[aria-controls="sucursales-admin-panel"]')?.click();
    fixture.detectChanges();

    host.querySelector<HTMLButtonElement>('.sucursal-admin button')?.click();
    fixture.detectChanges();
    backend.expectOne((request) => request.url.endsWith('/sucursales/41')).flush({
      id: 41,
      nombre: 'Centro',
      direccion: 'Av. Siempre Viva 123',
      telefono: '1112345678',
      descripcion: 'Sucursal de prueba',
      fechaCreacion: '2026-10-01',
      categoria: 'BARBERIA',
      horaApertura: '09:00',
      horaCierre: '18:00',
      diasApertura: ['MONDAY', 'TUESDAY'],
      puntuacion: 4.5,
      cantidadPuntuaciones: 2,
      fotoPerfil: null,
      imagenes: [],
    });
    fixture.detectChanges();

    expect(host.textContent).toContain('Sucursal de prueba');
    expect(host.textContent).toContain('Av. Siempre Viva 123');
    expect(host.querySelector('.detalle__acciones button')?.textContent).toContain('Eliminar sucursal');
    expect(host.querySelector<HTMLButtonElement>('.detalle__boton--eliminar')).not.toBeNull();
    expect(host.querySelector<HTMLAnchorElement>('.detalle__acciones a')?.getAttribute('href')).toBe('/sucursal/41');
    expect(host.querySelector('.detalle__acciones')?.textContent?.indexOf('Eliminar sucursal')).toBeLessThan(
      host.querySelector('.detalle__acciones')?.textContent?.indexOf('Ver sucursal') ?? -1,
    );
    expect(host.querySelector('.detalle__acciones')?.textContent).not.toContain('Modificar sucursal');

    host.querySelector<HTMLButtonElement>('.detalle__acciones button')?.click();
    fixture.detectChanges();
    expect(host.textContent).toContain('¿Estás seguro de que querés eliminar la sucursal Centro?');

    host.querySelector<HTMLButtonElement>('.detalle__confirmacion-acciones .ds-btn--danger')?.click();
    fixture.detectChanges();
    const eliminacion = backend.expectOne((request) => request.url.endsWith('/sucursales/eliminar/41'));
    expect(eliminacion.request.method).toBe('DELETE');
    eliminacion.flush('Se eliminó la sucursal');
    fixture.detectChanges();

    expect(host.querySelectorAll('.sucursal-admin')).toHaveLength(1);
    expect(host.textContent).toContain('Norte');
    expect(host.textContent).not.toContain('Centro');
    expect(host.querySelector('app-sucursal-detalle-modal ds-modal .ds-modal')).toBeNull();
  });

  it('inicia sin panel seleccionado y permite elegir ambas secciones con botones accesibles', () => {
    listar().flush([]);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const botonSucursales = host.querySelector<HTMLButtonElement>(
      '.admin__seccion[aria-controls="sucursales-admin-panel"]',
    )!;
    const botonSolicitudes = host.querySelector<HTMLButtonElement>(
      '.admin__seccion[aria-controls="admin-solicitudes-panel"]',
    )!;
    const panelSucursales = host.querySelector<HTMLElement>('#sucursales-admin-panel')!;
    const panelSolicitudes = host.querySelector<HTMLElement>('#admin-solicitudes-panel')!;

    expect(botonSucursales.getAttribute('aria-pressed')).toBe('false');
    expect(botonSolicitudes.getAttribute('aria-pressed')).toBe('false');
    expect(panelSucursales.hidden).toBe(true);
    expect(panelSolicitudes.hidden).toBe(true);
    expect(getComputedStyle(panelSucursales).display).toBe('none');
    expect(getComputedStyle(panelSolicitudes).display).toBe('none');

    botonSolicitudes.click();
    fixture.detectChanges();
    expect(botonSolicitudes.getAttribute('aria-pressed')).toBe('true');
    expect(panelSolicitudes.hidden).toBe(false);
    expect(panelSucursales.hidden).toBe(true);
    expect(getComputedStyle(panelSucursales).display).toBe('none');

    botonSucursales.click();
    fixture.detectChanges();
    expect(botonSucursales.getAttribute('aria-pressed')).toBe('true');
    expect(panelSucursales.hidden).toBe(false);

    botonSucursales.click();
    fixture.detectChanges();
    expect(botonSucursales.getAttribute('aria-pressed')).toBe('false');
    expect(botonSolicitudes.getAttribute('aria-pressed')).toBe('false');
    expect(panelSucursales.hidden).toBe(true);
    expect(panelSolicitudes.hidden).toBe(true);
  });

  it('integra las estadísticas como una sección seleccionable dentro del panel', () => {
    listar().flush([]);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const boton = host.querySelector<HTMLButtonElement>(
      '.admin__seccion[aria-controls="admin-estadisticas-panel"]',
    )!;
    const panel = host.querySelector<HTMLElement>('#admin-estadisticas-panel')!;

    expect(boton.textContent).toContain('Estadísticas');
    expect(panel.hidden).toBe(true);
    expect(host.querySelector('.graficos-integrados')).toBeNull();

    boton.click();
    fixture.detectChanges();
    expect(boton.getAttribute('aria-pressed')).toBe('true');
    expect(panel.hidden).toBe(false);
    expect(host.querySelector('.graficos-integrados')?.textContent).toContain('Estadísticas de administración cargadas');

    boton.click();
    fixture.detectChanges();
    expect(boton.getAttribute('aria-pressed')).toBe('false');
    expect(panel.hidden).toBe(true);
    expect(host.querySelector('.graficos-integrados')).toBeNull();
  });

  it('filtra usuarios, consulta su detalle y confirma la baja administrativa', () => {
    listar().flush([]);
    const host = fixture.nativeElement as HTMLElement;
    host.querySelector<HTMLButtonElement>('.admin__seccion[aria-controls="admin-usuarios-panel"]')?.click();
    fixture.detectChanges();
    expect(host.textContent).toContain('Lucía García');
    expect(host.textContent).toContain('Inactivo');

    const estado = host.querySelector<HTMLSelectElement>('.usuarios-filtros__estado select')!;
    estado.value = 'activos';
    estado.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    const filtradoEstado = backend.expectOne((request) => request.url.endsWith('/usuarios/listar/filtrar'));
    expect(filtradoEstado.request.params.get('activo')).toBe('true');
    filtradoEstado.flush([USUARIOS[0]]);
    fixture.detectChanges();
    expect(host.querySelectorAll('.usuario-admin')).toHaveLength(1);
    expect(host.querySelector('.usuario-admin__acciones')?.textContent).toContain('Ver detalle');
    expect(host.querySelector('.usuario-admin__acciones')?.textContent).not.toContain('Eliminar');

    host.querySelector<HTMLButtonElement>('.usuario-admin__acciones button')?.click();
    fixture.detectChanges();
    backend.expectOne((request) => request.url.endsWith('/usuarios/71')).flush({
      id: 71,
      nombre: 'Lucía',
      apellido: 'García',
      email: 'lucia@example.com',
      fechaCreacion: '2026-10-01',
      fotoPerfil: null,
      roles: ['CLIENTE'],
      sucursalesEmpleado: [],
    });
    fixture.detectChanges();
    expect(host.textContent).toContain('lucia@example.com');
    expect(host.textContent).toContain('CLIENTE');

    host.querySelector<HTMLButtonElement>('.usuario-modal__acciones .ds-btn--danger')?.click();
    fixture.detectChanges();
    expect(host.textContent).toContain('¿Estás seguro de que querés eliminar al usuario Lucía García?');
    host.querySelectorAll<HTMLButtonElement>('.ds-modal .ds-btn--danger').item(1)?.click();
    fixture.detectChanges();
    const eliminacion = backend.expectOne((request) => request.url.endsWith('/usuarios/eliminar/71'));
    expect(eliminacion.request.method).toBe('DELETE');
    eliminacion.flush('Se eliminó al usuario');
    fixture.detectChanges();
    const recarga = backend.expectOne((request) => request.url.endsWith('/usuarios/listar/filtrar'));
    expect(recarga.request.params.get('activo')).toBe('true');
    expect(recarga.request.params.has('nombre')).toBe(false);
    expect(recarga.request.params.has('apellido')).toBe(false);
    recarga.flush([]);
    fixture.detectChanges();
    expect(host.textContent).toContain('Se eliminó al usuario Lucía García.');
  });

  it('muestra error inline y permite reintentar la búsqueda de usuarios', () => {
    listar().flush([]);
    const host = fixture.nativeElement as HTMLElement;
    host.querySelector<HTMLButtonElement>('.admin__seccion[aria-controls="admin-usuarios-panel"]')?.click();
    fixture.detectChanges();
    const estado = host.querySelector<HTMLSelectElement>('.usuarios-filtros__estado select')!;
    estado.value = 'activos';
    estado.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    backend.expectOne((request) => request.url.endsWith('/usuarios/listar/filtrar')).flush({}, {
      status: 503,
      statusText: 'Unavailable',
    });
    fixture.detectChanges();
    expect(host.querySelector('#admin-usuarios-panel [role="alert"]')?.textContent).toContain('No se pudo actualizar');

    host.querySelector<HTMLButtonElement>('#admin-usuarios-panel [role="alert"] button')?.click();
    fixture.detectChanges();
    const reintento = backend.expectOne((request) => request.url.endsWith('/usuarios/listar/filtrar'));
    expect(reintento.request.params.get('activo')).toBe('true');
    reintento.flush(USUARIOS);
    fixture.detectChanges();
    expect(host.querySelector('#admin-usuarios-panel [role="alert"]')).toBeNull();
    expect(host.textContent).toContain('Lucía García');
  });

  it('muestra la foto de perfil a la izquierda y usa iniciales si falta o falla', () => {
    listar().flush([]);
    const host = fixture.nativeElement as HTMLElement;
    host.querySelector<HTMLButtonElement>('.admin__seccion[aria-controls="admin-usuarios-panel"]')?.click();
    fixture.detectChanges();

    const filas = host.querySelectorAll<HTMLElement>('.usuario-admin');
    const filaConFoto = filas[0];
    expect(filaConFoto.firstElementChild?.classList.contains('usuario-admin__foto')).toBe(true);
    const foto = filaConFoto.querySelector<HTMLImageElement>('.usuario-admin__foto img');
    expect(foto?.getAttribute('src')).toBe('https://res.cloudinary.com/example/lucia.jpg');
    expect(foto?.getAttribute('alt')).toBe('');
    foto?.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(filaConFoto.querySelector('.usuario-admin__foto')?.textContent?.trim()).toBe('LG');

    expect(filas[1].querySelector('.usuario-admin__foto')?.textContent?.trim()).toBe('MP');
  });

  it('permite reactivar desde el detalle y actualiza el estado en la lista', () => {
    listar().flush([]);
    const host = fixture.nativeElement as HTMLElement;
    host.querySelector<HTMLButtonElement>('.admin__seccion[aria-controls="admin-usuarios-panel"]')?.click();
    fixture.detectChanges();
    host.querySelectorAll<HTMLButtonElement>('.usuario-admin__acciones button').item(1)?.click();
    fixture.detectChanges();
    backend.expectOne((request) => request.url.endsWith('/usuarios/72')).flush({
      id: 72,
      nombre: 'Mario',
      apellido: 'Paz',
      email: 'mario@example.com',
      fechaCreacion: '2026-10-01',
      fotoPerfil: null,
      roles: ['CLIENTE'],
      sucursalesEmpleado: [],
    });
    fixture.detectChanges();

    expect(host.textContent).toContain('Esta cuenta está inactiva.');
    expect(host.querySelector('.usuario-modal__acciones .ds-btn--danger')).toBeNull();
    host.querySelector<HTMLButtonElement>('.usuario-modal__reactivacion button')?.click();
    fixture.detectChanges();
    const activacion = backend.expectOne((request) => request.url.endsWith('/usuarios/activar/72'));
    expect(activacion.request.method).toBe('PATCH');
    activacion.flush('Se activó al usuario');
    fixture.detectChanges();

    expect(host.textContent).toContain('Esta cuenta está activa.');
    expect(host.querySelector('.usuario-admin__datos')?.textContent).toContain('Activo');
    expect(host.querySelector('.usuario-modal__reactivacion button')).toBeNull();
    expect(host.querySelector('.usuario-modal__acciones .ds-btn--danger')?.textContent).toContain('Eliminar usuario');
  });

  it('aprueba una solicitud pendiente, actualiza el estado y quita las acciones', () => {
    listar().flush([SOLICITUDES[0]]);
    fixture.detectChanges();
    alternar();
    peticionDetalle().flush(detalle(31, 'PENDIENTE'));
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    host.querySelector<HTMLButtonElement>('.solicitud__accion--aprobar')?.click();
    fixture.detectChanges();

    const peticion = backend.expectOne((request) =>
      request.url.endsWith('/solicitudes-empleador/31/aprobar'),
    );
    expect(peticion.request.method).toBe('PATCH');

    const aprobar = host.querySelector<HTMLButtonElement>('.solicitud__accion--aprobar');
    expect(aprobar?.disabled).toBe(true);
    expect(aprobar?.textContent).toContain('Aprobando');

    peticion.flush('Se aprobó la solicitud');
    fixture.detectChanges();

    expect(host.textContent).toContain('La solicitud fue aprobada');
    expect(host.querySelector('.solicitud__resumen .estado')?.textContent).toContain('Aprobada');
    expect(host.querySelector('.solicitud__accion')).toBeNull();
    expect(host.textContent).toContain('ya está resuelta');
    expect(host.querySelector('.panel__contador')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      '0 pendientes',
    );
  });

  it('ante un error al rechazar muestra el mensaje inline y permite volver a intentar', () => {
    listar().flush([SOLICITUDES[0]]);
    fixture.detectChanges();
    alternar();
    peticionDetalle().flush(detalle(31, 'PENDIENTE'));
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const rechazar = host.querySelector<HTMLButtonElement>('.solicitud__accion--rechazar');
    rechazar?.click();
    fixture.detectChanges();

    backend
      .expectOne((request) => request.url.endsWith('/solicitudes-empleador/31/rechazar'))
      .flush('Solo se pueden rechazar solicitudes pendientes', {
        status: 409,
        statusText: 'Conflict',
      });
    fixture.detectChanges();

    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      'Solo se pueden rechazar solicitudes pendientes',
    );
    expect(host.querySelector('.solicitud__accion--rechazar')).not.toBeNull();
    expect(
      host.querySelector<HTMLButtonElement>('.solicitud__accion--rechazar')?.disabled,
    ).toBe(false);
  });

  it('no ofrece acciones cuando el detalle ya está resuelto', () => {
    listar().flush([SOLICITUDES[0]]);
    fixture.detectChanges();
    alternar();
    peticionDetalle().flush(detalle(31, 'APROBADA'));
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.solicitud__accion')).toBeNull();
    expect(host.textContent).toContain('ya está resuelta');
  });

  it('muestra el vacío cuando no hay pendientes', () => {
    listar().flush([]);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('No hay solicitudes pendientes');
    expect(host.querySelector('.panel__contador')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      '0 pendientes',
    );
  });

  it('ante un error de carga muestra el error inline y reintenta', () => {
    listar().flush({}, { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('No pudimos cargar las solicitudes');

    host.querySelector<HTMLButtonElement>('.estado--error .boton')?.click();
    fixture.detectChanges();

    listar().flush([SOLICITUDES[0]]);
    fixture.detectChanges();

    expect(host.querySelector('.estado--error')).toBeNull();
    expect(host.textContent).toContain('Ana Pérez');
  });
});
