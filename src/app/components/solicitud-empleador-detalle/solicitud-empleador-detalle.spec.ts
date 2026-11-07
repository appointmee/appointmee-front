import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SolicitudEmpleadorDetalleDTO } from '../../models/solicitud-empleador';
import { SolicitudEmpleadorDetalle } from './solicitud-empleador-detalle';

const DETALLE: SolicitudEmpleadorDetalleDTO = {
  id: 42,
  motivo: 'Quiero publicar mis sucursales en AppointMee.',
  estado: 'PENDIENTE',
  fechaSolicitud: '2026-11-01',
  usuario: {
    id: 1,
    nombre: 'Ana',
    apellido: 'Pérez',
    email: 'ana@example.com',
    urlFotoPerfil: null,
  },
};

describe('SolicitudEmpleadorDetalle', () => {
  let fixture: ComponentFixture<SolicitudEmpleadorDetalle>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SolicitudEmpleadorDetalle],
    }).compileComponents();

    fixture = TestBed.createComponent(SolicitudEmpleadorDetalle);
    fixture.componentRef.setInput('detalle', DETALLE);
    fixture.detectChanges();
  });

  afterEach(() => fixture.destroy());

  it('en la vista del usuario muestra solo el título genérico, sin número ni subtítulo', () => {
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('h3')?.textContent?.trim()).toBe('Detalles de la solicitud');
    expect(host.textContent).not.toContain('Solicitud #');
    expect(host.querySelector('.detalle__eyebrow')).toBeNull();
  });

  it('en el panel administrador conserva el subtítulo y el número de solicitud', () => {
    fixture.componentRef.setInput('modo', 'admin');
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('.detalle__eyebrow')?.textContent?.trim()).toBe(
      'Detalle de la solicitud',
    );
    expect(host.querySelector('h3')?.textContent?.trim()).toBe('Solicitud #42');
  });
});
