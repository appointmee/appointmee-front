import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { EmpleadoDTO } from '../../models/empleado';
import { EquipoSucursal } from './equipo-sucursal';

const EMPLEADOS: readonly EmpleadoDTO[] = [
  {
    id: 7,
    nombre: 'Ana',
    apellido: 'Pérez',
    urlFotoPerfil: null,
    puntuacion: 4,
    cantidadPuntuaciones: 2,
  },
  {
    id: 8,
    nombre: 'Luis',
    apellido: 'Gómez',
    urlFotoPerfil: null,
    puntuacion: null,
    cantidadPuntuaciones: 0,
  },
];

describe('EquipoSucursal · eliminar empleados', () => {
  let fixture: ComponentFixture<EquipoSucursal>;
  let backend: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EquipoSucursal],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(EquipoSucursal);
    fixture.componentRef.setInput('sucursalId', 5);
    fixture.componentRef.setInput('limite', null);
    fixture.componentRef.setInput('mostrarVerMas', false);
    fixture.componentRef.setInput('puedeEliminar', true);
    backend = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    backend
      .expectOne((request) => request.url.endsWith('/sucursales/5/elegir-empleado'))
      .flush(EMPLEADOS);
    fixture.detectChanges();
  });

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function textoTarjetas(): string {
    return Array.from(host().querySelectorAll('.equipo-card'))
      .map((tarjeta) => tarjeta.textContent ?? '')
      .join(' ');
  }

  function botonEliminar(): HTMLButtonElement {
    const boton = host().querySelector<HTMLButtonElement>('.equipo-card__eliminar');
    expect(boton).not.toBeNull();
    return boton!;
  }

  function botonPorTexto(texto: string): HTMLButtonElement {
    const boton = Array.from(host().querySelectorAll<HTMLButtonElement>('button')).find(
      (candidato) => candidato.textContent?.trim() === texto,
    );
    expect(boton).toBeDefined();
    return boton!;
  }

  function confirmar(empleadoId: number, respuesta = 'Se eliminó al empleado correctamente'): void {
    backend
      .expectOne(
        (request) =>
          request.method === 'DELETE' &&
          request.url.endsWith(`/sucursales/5/empleados/eliminar/${empleadoId}`),
      )
      .flush(respuesta);
    fixture.detectChanges();
  }

  it('expone el diálogo de confirmación de forma accesible', () => {
    botonEliminar().click();
    fixture.detectChanges();

    const dialogo = host().querySelector('[role="dialog"]');
    expect(dialogo).not.toBeNull();
    expect(dialogo?.getAttribute('aria-modal')).toBe('true');
    expect(dialogo?.getAttribute('aria-labelledby')).toBe('eliminar-empleado-titulo');
    expect(document.activeElement).toBe(dialogo);
  });

  it('cierra la confirmación con Escape sin eliminar', () => {
    botonEliminar().click();
    fixture.detectChanges();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();

    expect(host().querySelector('[role="dialog"]')).toBeNull();
    backend.expectNone((request) => request.method === 'DELETE');
  });

  it('pide confirmación y no elimina hasta confirmar', () => {
    botonEliminar().click();
    fixture.detectChanges();

    expect(host().textContent).toContain('¿Confirmás que querés eliminar a');
    expect(host().textContent).toContain('Ana Pérez');
    backend.expectNone((request) => request.method === 'DELETE');

    botonPorTexto('Cancelar').click();
    fixture.detectChanges();

    expect(host().textContent).not.toContain('¿Confirmás que querés eliminar a');
    backend.expectNone((request) => request.method === 'DELETE');
  });

  it('elimina al confirmar, actualiza el listado y muestra el éxito inline', () => {
    botonEliminar().click();
    fixture.detectChanges();

    botonPorTexto('Sí, eliminar').click();
    fixture.detectChanges();

    backend
      .expectOne(
        (request) =>
          request.method === 'DELETE' &&
          request.url.endsWith('/sucursales/5/empleados/eliminar/7'),
      )
      .flush('Se eliminó al empleado correctamente');

    fixture.detectChanges();

    expect(textoTarjetas()).not.toContain('Ana');
    expect(host().textContent).not.toContain('¿Confirmás que querés eliminar a');
    expect(host().querySelector('.equipo__aviso--exito')?.textContent).toContain(
      'Eliminamos a Ana Pérez del equipo.',
    );
  });

  it('bloquea dobles confirmaciones mientras elimina', () => {
    botonEliminar().click();
    fixture.detectChanges();

    const confirmar = botonPorTexto('Sí, eliminar');
    confirmar.click();
    confirmar.click();
    fixture.detectChanges();

    backend
      .expectOne(
        (request) =>
          request.method === 'DELETE' &&
          request.url.endsWith('/sucursales/5/empleados/eliminar/7'),
      )
      .flush('Se eliminó al empleado correctamente');
    fixture.detectChanges();

    expect(textoTarjetas()).not.toContain('Ana');
  });

  it('muestra el vacío al eliminar al último empleado', () => {
    for (const id of [7, 8]) {
      botonEliminar().click();
      fixture.detectChanges();
      botonPorTexto('Sí, eliminar').click();
      fixture.detectChanges();
      confirmar(id);
    }

    expect(host().textContent).toContain('Todavía no hay profesionales cargados');
    expect(host().querySelectorAll('.equipo-card')).toHaveLength(0);
  });

  it('informa sin conexión al intentar eliminar', () => {
    botonEliminar().click();
    fixture.detectChanges();
    botonPorTexto('Sí, eliminar').click();
    fixture.detectChanges();

    backend
      .expectOne(
        (request) =>
          request.method === 'DELETE' &&
          request.url.endsWith('/sucursales/5/empleados/eliminar/7'),
      )
      .flush(null, { status: 0, statusText: 'Unknown Error' });
    fixture.detectChanges();

    expect(host().querySelector('.equipo__aviso--error')?.textContent).toContain(
      'No pudimos conectarnos con el servidor.',
    );
    expect(textoTarjetas()).toContain('Ana');
  });

  it('muestra el error inline y conserva al empleado si falla la eliminación', () => {
    botonEliminar().click();
    fixture.detectChanges();

    botonPorTexto('Sí, eliminar').click();
    fixture.detectChanges();

    backend
      .expectOne(
        (request) =>
          request.method === 'DELETE' &&
          request.url.endsWith('/sucursales/5/empleados/eliminar/7'),
      )
      .flush('No tenés permisos', { status: 403, statusText: 'Forbidden' });

    fixture.detectChanges();

    expect(host().querySelector('.equipo__aviso--error')?.textContent).toContain(
      'Solo el empleador de esta sucursal puede eliminar empleados.',
    );
    expect(textoTarjetas()).toContain('Ana');
    expect(textoTarjetas()).toContain('Pérez');
  });

  it('avisa cuando el empleado ya no forma parte del equipo', () => {
    botonEliminar().click();
    fixture.detectChanges();
    botonPorTexto('Sí, eliminar').click();
    fixture.detectChanges();

    backend
      .expectOne(
        (request) =>
          request.method === 'DELETE' &&
          request.url.endsWith('/sucursales/5/empleados/eliminar/7'),
      )
      .flush('No es empleado', { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();

    expect(host().querySelector('.equipo__aviso--error')?.textContent).toContain(
      'Ese empleado ya no forma parte del equipo.',
    );
  });

  it('no muestra la acción de eliminar si el usuario no puede gestionar el equipo', () => {
    fixture.componentRef.setInput('puedeEliminar', false);
    fixture.detectChanges();

    expect(host().querySelector('.equipo-card__eliminar')).toBeNull();
  });
});
