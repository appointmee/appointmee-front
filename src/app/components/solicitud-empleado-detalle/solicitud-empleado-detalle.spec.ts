import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SolicitudEmpleadoDetalleDTO } from '../../models/solicitud-empleado';
import { SolicitudEmpleadoDetalle } from './solicitud-empleado-detalle';

const DETALLE: SolicitudEmpleadoDetalleDTO = {
  id: 987,
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
    id: 987,
    nombre: 'Barbería Central',
    categoria: 'BARBERIA',
    fotoPerfil: null,
    puntuacion: 4.5,
    cantidadPuntuaciones: 10,
    diasApertura: ['LUNES'],
  },
};

describe('SolicitudEmpleadoDetalle', () => {
  let fixture: ComponentFixture<SolicitudEmpleadoDetalle>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SolicitudEmpleadoDetalle],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(SolicitudEmpleadoDetalle);
    fixture.componentRef.setInput('detalle', DETALLE);
    fixture.detectChanges();
  });

  afterEach(() => fixture.destroy());

  it('muestra sucursal, empleado, categoría y valoración sin exponer identificadores', () => {
    const host = fixture.nativeElement as HTMLElement;
    const contenido = host.textContent ?? '';

    expect(contenido).toContain('Invitación recibida');
    expect(contenido).toContain('Barbería Central');
    expect(contenido).toContain('Barberia');
    expect(contenido).toContain('4,5 de 5 · 10 reseñas');
    expect(contenido).toContain('Ana Pérez');
    expect(contenido).toContain('ana@example.com');
    expect(contenido).toContain('Tu perfil');
    expect(contenido).not.toContain('987');

    const enlace = host.querySelector<HTMLAnchorElement>('.detalle__enlace');
    expect(enlace?.textContent).toContain('Ver sucursal');
    expect(enlace?.getAttribute('href')).toBe('/sucursal/987');
  });

  it('en una invitación enviada identifica al empleado invitado y el estado pendiente', () => {
    fixture.componentRef.setInput('tipo', 'enviada');
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;

    expect(host.textContent).toContain('Invitación enviada');
    expect(host.textContent).toContain('Empleado invitado');
    expect(host.textContent).toContain(
      'La invitación está pendiente de respuesta del empleado.',
    );
  });

  it('indica cuando una invitación ya fue resuelta', () => {
    fixture.componentRef.setInput('detalle', {
      ...DETALLE,
      estadoSolicitud: 'RECHAZADA',
    });
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;

    expect(host.textContent).toContain('Rechazada');
    expect(host.textContent).toContain(
      'La invitación fue rechazada y ya no admite cambios.',
    );
  });
});
