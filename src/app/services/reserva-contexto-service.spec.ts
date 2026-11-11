import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import {
  ContextoReserva,
  VERSION_CONTEXTO_RESERVA,
  reservaContextoService,
} from './reserva-contexto-service';

describe('reservaContextoService · contexto temporal de la reserva', () => {
  let service: reservaContextoService;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([])],
    });
    service = TestBed.inject(reservaContextoService);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    service.limpiar();
    sessionStorage.clear();
  });

  it('guarda el contexto con la clave versionada en sessionStorage', () => {
    const contexto: ContextoReserva = service.guardar(7, 3);

    expect(contexto).toEqual({ version: VERSION_CONTEXTO_RESERVA, sucursalId: 7, servicioId: 3 });
    expect(sessionStorage.getItem('appointmee.reserva-contexto.v1')).toBe(
      JSON.stringify(contexto),
    );
  });

  it('guarda el contexto sin servicio cuando todavia no se eligió', () => {
    expect(service.guardar(7, null)).toEqual({
      version: VERSION_CONTEXTO_RESERVA,
      sucursalId: 7,
      servicioId: null,
    });
  });

  it('usa sessionStorage y no localStorage para el contexto temporal', () => {
    service.guardar(7, 3);

    expect(sessionStorage.getItem('appointmee.reserva-contexto.v1')).not.toBeNull();
    expect(localStorage.getItem('appointmee.reserva-contexto.v1')).toBeNull();
  });

  it('restaura el contexto guardado en la misma sesión', () => {
    service.guardar(7, 3);

    expect(service.obtener()).toEqual({ version: VERSION_CONTEXTO_RESERVA, sucursalId: 7, servicioId: 3 });
    expect(service.servicioSeleccionado(7)).toBe(3);
    expect(service.servicioSeleccionado(8)).toBeNull();
  });

  it('descarta contextos con versión o datos invalidos', () => {
    sessionStorage.setItem(
      'appointmee.reserva-contexto.v1',
      JSON.stringify({ version: 2, sucursalId: 7, servicioId: 3 }),
    );
    expect(service.obtener()).toBeNull();

    sessionStorage.setItem(
      'appointmee.reserva-contexto.v1',
      JSON.stringify({ version: VERSION_CONTEXTO_RESERVA, sucursalId: -4, servicioId: 3 }),
    );
    expect(service.obtener()).toBeNull();

    sessionStorage.setItem(
      'appointmee.reserva-contexto.v1',
      JSON.stringify({ version: VERSION_CONTEXTO_RESERVA, sucursalId: 7, servicioId: 0 }),
    );
    expect(service.obtener()).toBeNull();
  });

  it('limpia el contexto temporal', () => {
    service.guardar(7, 3);
    service.limpiar();

    expect(service.obtener()).toBeNull();
    expect(sessionStorage.getItem('appointmee.reserva-contexto.v1')).toBeNull();
  });

  it('descarta el contexto al navegar fuera del flujo de reserva', async () => {
    service.guardar(7, 3);
    await router.navigateByUrl('/');
    expect(service.obtener()).toBeNull();
  });
});
