import { HttpErrorResponse } from '@angular/common/http';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';

import { routes } from '../../app.routes';
import { RecomendacionesSucursalesDTO, SucursalMiniDTO } from '../../models/sucursal';
import { sucursalService } from '../../services/sucursal-service';
import { Sucursales } from '../sucursales/sucursales';
import { SucursalesDescubrimiento } from './sucursales-descubrimiento';

@Component({ template: '' })
class EmptyPage {}

function recomendacionesVacias(): RecomendacionesSucursalesDTO {
  return {
    mejores: [],
    masDemandadas: [],
    nuevas: [],
    vistasRecientes: [],
    paraVos: [],
    todas: [],
  };
}

function sucursal(id: number, nombre: string): SucursalMiniDTO {
  return {
    id,
    nombre,
    categoria: 'PELUQUERIA',
    fotoPerfil: null,
    puntuacion: 4.5,
    cantidadPuntuaciones: 8,
  };
}

describe('SucursalesDescubrimiento: pantalla principal de sucursales (SCRUM-364)', () => {
  let recomendaciones: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    recomendaciones = vi.fn<
      () => Observable<RecomendacionesSucursalesDTO>
    >(() => of(recomendacionesVacias()));

    TestBed.configureTestingModule({
      imports: [SucursalesDescubrimiento],
      providers: [
        provideRouter([
          { path: 'listado-sucursales', component: EmptyPage },
          { path: 'sucursal/:id', component: EmptyPage },
        ]),
        { provide: sucursalService, useValue: { recomendaciones } },
      ],
    });
  });

  it('no ofrece buscador, selector de categorías ni filtros', () => {
    const fixture = TestBed.createComponent(SucursalesDescubrimiento);
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;

    expect(raiz.querySelector('[role="search"]')).toBeNull();
    expect(raiz.querySelector('input, select, [role="combobox"]')).toBeNull();
    expect(raiz.querySelector('.branch-search, .branch-suggestions')).toBeNull();
    expect(recomendaciones).toHaveBeenCalledOnce();
  });

  it('muestra las seis secciones en el orden acordado, cada una con su carrusel', () => {
    recomendaciones.mockReturnValue(
      of({
        mejores: [sucursal(1, 'Mejor')],
        masDemandadas: [sucursal(2, 'Demandada')],
        nuevas: [sucursal(3, 'Nueva')],
        vistasRecientes: [sucursal(4, 'Visitada')],
        paraVos: [sucursal(5, 'Para vos')],
        todas: [sucursal(6, 'Todas')],
      }),
    );

    const fixture = TestBed.createComponent(SucursalesDescubrimiento);
    fixture.detectChanges();

    const titulos = Array.from(
      fixture.nativeElement.querySelectorAll('.descubrir .carrusel__titulo'),
    ) as HTMLElement[];
    expect(titulos.map((titulo) => titulo.textContent?.trim())).toEqual([
      'Las mejores de AppointMee',
      'Las más demandadas',
      'Nuevas en AppointMee',
      'Visto recientemente',
      'Recomendado para vos',
      'Todas las sucursales',
    ]);
    expect(fixture.nativeElement.querySelectorAll('.carrusel__track')).toHaveLength(6);
    expect(fixture.nativeElement.querySelectorAll('.carrusel__card')).toHaveLength(6);
  });

  it('oculta las secciones vacías y ofrece «Ver todas» sólo en la preview hacia el listado', () => {
    recomendaciones.mockReturnValue(
      of({
        ...recomendacionesVacias(),
        mejores: [sucursal(1, 'Mejor')],
        todas: [sucursal(6, 'Todas')],
      }),
    );

    const fixture = TestBed.createComponent(SucursalesDescubrimiento);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.carrusel')).toHaveLength(2);
    expect(fixture.nativeElement.textContent).toContain('Las mejores de AppointMee');
    expect(fixture.nativeElement.textContent).not.toContain('Visto recientemente');
    const verTodas = fixture.nativeElement.querySelector('.carrusel__ver-todas');
    expect(verTodas.getAttribute('href')).toBe('/listado-sucursales');
    expect(verTodas.textContent).toContain('Ver todas');
  });

  it('muestra skeletons accesibles mientras cargan las recomendaciones', () => {
    recomendaciones.mockReturnValue(new Subject<RecomendacionesSucursalesDTO>());

    const fixture = TestBed.createComponent(SucursalesDescubrimiento);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.descubrir__skeleton[aria-busy="true"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[role="status"]').textContent).toContain(
      'Cargando recomendaciones',
    );
    expect(fixture.nativeElement.querySelectorAll('.descubrir__skeleton-card')).toHaveLength(8);
  });

  it('muestra estado vacío con salida al listado completo cuando no hay secciones', () => {
    const fixture = TestBed.createComponent(SucursalesDescubrimiento);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.descubrir__estado[role="status"]')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain(
      'Por ahora no hay sucursales para mostrar',
    );
    expect(
      fixture.nativeElement.querySelector('.descubrir__estado a').getAttribute('href'),
    ).toBe('/listado-sucursales');
  });

  it('muestra error inline, bloquea el doble reintento y se recupera con datos', () => {
    const respuesta = new Subject<RecomendacionesSucursalesDTO>();
    recomendaciones
      .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 0 })))
      .mockReturnValue(respuesta);

    const fixture = TestBed.createComponent(SucursalesDescubrimiento);
    fixture.detectChanges();

    const alerta = fixture.nativeElement.querySelector('.descubrir__estado[role="alert"]');
    expect(alerta.textContent).toContain('No pudimos cargar las recomendaciones');
    const reintentar = alerta.querySelector('button') as HTMLButtonElement;
    expect(reintentar.disabled).toBe(false);

    reintentar.click();
    fixture.detectChanges();
    expect(reintentar.disabled).toBe(true);
    expect(reintentar.textContent).toContain('Reintentando');
    reintentar.click();
    expect(recomendaciones).toHaveBeenCalledTimes(2);

    respuesta.next({ ...recomendacionesVacias(), mejores: [sucursal(1, 'Mejor')] });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.carrusel__card')).toBeTruthy();
  });

  it('conecta /sucursales con el descubrimiento y /listado-sucursales con el listado', async () => {
    const descubrimiento = routes.find((ruta) => ruta.path === 'sucursales');
    const listado = routes.find((ruta) => ruta.path === 'listado-sucursales');

    expect(descubrimiento).toBeDefined();
    expect(listado).toBeDefined();
    const cargarDescubrimiento = descubrimiento?.loadComponent as () => Promise<unknown>;
    const cargarListado = listado?.loadComponent as () => Promise<unknown>;

    await expect(cargarDescubrimiento()).resolves.toBe(SucursalesDescubrimiento);
    await expect(cargarListado()).resolves.toBe(Sucursales);
  });
});
