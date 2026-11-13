import { Component } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, RouterOutlet, provideRouter } from '@angular/router';

import { ProfesionalesReserva } from './profesionales-reserva';

@Component({
  standalone: true,
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
class TestShell {}

const SERVICIO = {
  id: 1,
  nombre: 'Corte de pelo',
  descripcion: 'Corte clásico',
  duracion: 45,
  precio: 12000,
  fotoPerfil: null,
  puntuacion: null,
  cantidadPuntuaciones: 0,
  nombreSucursal: 'Sucursal Flores',
};

const EMPLEADO = {
  id: 41,
  nombre: 'Ana',
  apellido: 'Gómez',
  urlFotoPerfil: 'https://res.cloudinary.com/appointmee/image/upload/perfiles/ana.jpg',
  puntuacion: null,
  cantidadPuntuaciones: 0,
};

describe('ProfesionalesReserva · fotos de profesionales', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<TestShell>>;
  let router: Router;
  let backend: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestShell],
      providers: [
        provideRouter([
          { path: 'sucursal/:sucursalId/profesionales', component: ProfesionalesReserva },
        ]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TestShell);
    fixture.detectChanges();
    router = TestBed.inject(Router);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    fixture.destroy();
    backend.verify();
  });

  async function abrirConFoto(urlFotoPerfil: string | null): Promise<HTMLImageElement> {
    await router.navigateByUrl('/sucursal/7/profesionales?servicioId=1');
    fixture.detectChanges();

    backend
      .expectOne((request) => request.url.endsWith('/servicios/listar/sucursal/7'))
      .flush([SERVICIO]);
    backend
      .expectOne((request) => request.url.endsWith('/sucursales/7/elegir-empleado'))
      .flush([{ ...EMPLEADO, urlFotoPerfil }]);

    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement.querySelector('img') as HTMLImageElement;
  }

  it('muestra avatar de reemplazo si el profesional no tiene foto', async () => {
    const imagen = await abrirConFoto(null);

    expect(imagen.getAttribute('src')).toMatch(/^data:image\/svg\+xml/);
    expect(imagen.getAttribute('alt')).toBe('Fotografía de Ana Gómez');
  });

  it('muestra avatar de reemplazo si la URL de la foto no carga', async () => {
    const imagen = await abrirConFoto(EMPLEADO.urlFotoPerfil);
    expect(imagen.getAttribute('src')).toBe(EMPLEADO.urlFotoPerfil);

    imagen.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    expect(imagen.getAttribute('src')).toMatch(/^data:image\/svg\+xml/);
  });
});
