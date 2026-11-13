import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import {
  SolicitudEmpleadoDetalleDTO,
  SolicitudEmpleadoVista,
} from '../../models/solicitud-empleado';
import { SolicitudEmpleadoCard } from './solicitud-empleado-card';

const VISTA: SolicitudEmpleadoVista = {
  id: 777,
  titulo: 'Barbería Central',
  subtitulo: 'Invitación de la sucursal',
  iniciales: 'BC',
  fechaSolicitud: '2026-11-02',
};

const DETALLE: SolicitudEmpleadoDetalleDTO = {
  id: 777,
  estadoSolicitud: 'PENDIENTE',
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
    nombre: 'Barbería Central',
    categoria: 'BARBERIA',
    fotoPerfil: null,
    puntuacion: null,
    cantidadPuntuaciones: 0,
    diasApertura: [],
  },
};

describe('SolicitudEmpleadoCard', () => {
  let fixture: ComponentFixture<SolicitudEmpleadoCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SolicitudEmpleadoCard],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(SolicitudEmpleadoCard);
    fixture.componentRef.setInput('solicitud', VISTA);
    fixture.componentRef.setInput('tipo', 'recibida');
    fixture.detectChanges();
  });

  afterEach(() => fixture.destroy());

  it('sin detalle informa que el estado se consulta y mantiene el resumen visible', () => {
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('h3')?.textContent?.trim()).toBe('Barbería Central');
    expect(host.querySelector('.estado')?.textContent?.trim()).toBe('Estado a consultar');
    expect(host.textContent).toContain('Invitación de la sucursal');
    expect(host.querySelector('.solicitud__detalle')).toBeNull();
    expect(host.querySelector('.solicitud__acciones')).toBeNull();
  });

  it('emite la acción de alternar el detalle con un nombre accesible', () => {
    const host = fixture.nativeElement as HTMLElement;
    const alternar = vi.fn();
    fixture.componentInstance.alternar.subscribe(alternar);
    const boton = host.querySelector<HTMLButtonElement>('.solicitud__alternar');

    expect(boton?.getAttribute('aria-expanded')).toBe('false');
    expect(boton?.getAttribute('aria-label')).toBe(
      'Ver detalle de la invitación de Barbería Central',
    );
    boton?.click();

    expect(alternar).toHaveBeenCalledTimes(1);
  });

  it('en una invitación recibida pendiente permite aprobar y rechazar', () => {
    const host = fixture.nativeElement as HTMLElement;
    const aprobar = vi.fn();
    const rechazar = vi.fn();
    fixture.componentInstance.aprobar.subscribe(aprobar);
    fixture.componentInstance.rechazar.subscribe(rechazar);
    fixture.componentRef.setInput('detalle', DETALLE);
    fixture.componentRef.setInput('expandida', true);
    fixture.detectChanges();

    expect(host.textContent).toContain('Detalles de la invitación');
    const rechazarBoton = Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find(
      (boton) => boton.textContent?.includes('Rechazar invitación'),
    );
    const aprobarBoton = Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find(
      (boton) => boton.textContent?.includes('Aprobar invitación'),
    );

    expect(rechazarBoton).toBeDefined();
    expect(aprobarBoton).toBeDefined();

    rechazarBoton?.click();
    aprobarBoton?.click();

    expect(rechazar).toHaveBeenCalledTimes(1);
    expect(aprobar).toHaveBeenCalledTimes(1);
  });

  it('en una invitación enviada no ofrece acciones y explica quién debe responder', () => {
    const host = fixture.nativeElement as HTMLElement;
    fixture.componentRef.setInput('tipo', 'enviada');
    fixture.componentRef.setInput('detalle', DETALLE);
    fixture.componentRef.setInput('expandida', true);
    fixture.detectChanges();

    expect(host.querySelector('.solicitud__acciones')).toBeNull();
    expect(host.textContent).toContain(
      'Solo el empleado puede aceptar o rechazar esta invitación.',
    );
  });

  it('bloquea las acciones mientras resuelve y muestra el error de la acción', () => {
    const host = fixture.nativeElement as HTMLElement;
    fixture.componentRef.setInput('detalle', DETALLE);
    fixture.componentRef.setInput('expandida', true);
    fixture.componentRef.setInput('resolviendo', 'aprobar');
    fixture.componentRef.setInput('errorAccion', 'No pudimos resolver la solicitud.');
    fixture.detectChanges();

    const acciones = host.querySelectorAll<HTMLButtonElement>('.solicitud__accion');
    expect(Array.from(acciones).every((boton) => boton.disabled)).toBe(true);
    expect(host.textContent).toContain('Aprobando…');
    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      'No pudimos resolver la solicitud.',
    );
  });

  it('muestra el error de detalle y permite reintentar', () => {
    const host = fixture.nativeElement as HTMLElement;
    const reintentar = vi.fn();
    fixture.componentInstance.reintentarDetalle.subscribe(reintentar);
    fixture.componentRef.setInput('expandida', true);
    fixture.componentRef.setInput('errorDetalle', 'No pudimos cargar el detalle.');
    fixture.detectChanges();

    expect(host.querySelector('.solicitud__error')?.textContent).toContain(
      'No pudimos cargar el detalle.',
    );

    host.querySelector<HTMLButtonElement>('.solicitud__error button')?.click();
    expect(reintentar).toHaveBeenCalledTimes(1);
  });
});
