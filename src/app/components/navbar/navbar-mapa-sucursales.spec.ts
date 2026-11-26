import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { authService } from '../../services/auth-service';
import { notificacionService } from '../../services/notificacion-service';
import { usuarioService } from '../../services/usuario-service';
import { Navbar } from './navbar';

@Component({ template: '' })
class EmptyPage {}

const notificacionesMock = {
  provide: notificacionService,
  useValue: {
    contarNoLeidas: () => of({ noLeidas: 0 }),
    listar: () => of({
      contenido: [],
      pagina: 0,
      tamano: 20,
      totalElementos: 0,
      totalPaginas: 0,
      noLeidas: 0,
    }),
  },
};

function configurar(autenticado: boolean): ComponentFixture<Navbar> {
  TestBed.configureTestingModule({
    imports: [Navbar],
    providers: [
      notificacionesMock,
      provideRouter([
        { path: 'mapa-sucursales', component: EmptyPage },
        { path: 'sucursales', component: EmptyPage },
      ]),
      { provide: usuarioService, useValue: { obtenerPerfil: () => of(null) } },
      {
        provide: authService,
        useValue: {
          autenticado: signal(autenticado),
          visitante: signal(!autenticado),
          restaurando: signal(false),
          perfil: signal(null),
          iniciales: signal(''),
          tieneAlgunRol: () => false,
        },
      },
    ],
  });

  const fixture = TestBed.createComponent(Navbar);
  fixture.detectChanges();
  return fixture;
}

describe('US-MAP-06 · Acceso al mapa global desde el navbar', () => {
  beforeEach(() => TestBed.resetTestingModule());
  afterEach(() => document.body.classList.remove('nav-locked'));

  it('muestra el mapa a visitantes en la barra superior', () => {
    const html = configurar(false).nativeElement as HTMLElement;

    expect(html.querySelector('.navbar__cta[href="/mapa-sucursales"]')).not.toBeNull();
  });

  it('muestra el mapa a visitantes en el menú móvil', () => {
    const fixture = configurar(false);
    const html = fixture.nativeElement as HTMLElement;

    html.querySelector<HTMLButtonElement>('.burger')?.click();
    fixture.detectChanges();

    expect(html.querySelector('.sheet a[href="/mapa-sucursales"]')).not.toBeNull();
  });

  it('muestra el mapa en la navegación principal de usuarios autenticados', () => {
    const html = configurar(true).nativeElement as HTMLElement;

    expect(html.querySelector('.nav a[href="/mapa-sucursales"]')).not.toBeNull();
  });
});
