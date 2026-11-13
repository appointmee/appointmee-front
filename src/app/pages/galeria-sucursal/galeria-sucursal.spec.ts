import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';

import { GaleriaSucursal } from './galeria-sucursal';

describe('GaleriaSucursal', () => {
  let fixture: ComponentFixture<GaleriaSucursal>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GaleriaSucursal],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => '12' } } },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(GaleriaSucursal);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne((request) => request.url.endsWith('/sucursales/12')).flush({
      id: 12,
      nombre: 'Sucursal de prueba',
      fotoPerfil: 'https://img.ejemplo/sucursal.jpg',
    });
  });

  afterEach(() => {
    http.verify();
    fixture.destroy();
  });

  it('muestra las imágenes existentes y un placeholder accesible si falla una', () => {
    http.expectOne((request) => request.url.endsWith('/sucursales/12/imagenes')).flush([
      { id: 21, url: 'https://img.ejemplo/uno.jpg' },
      { id: 22, url: 'https://img.ejemplo/dos.jpg' },
    ]);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.galeria__fondo img')?.getAttribute('src'))
      .toBe('https://img.ejemplo/sucursal.jpg');
    const imagen = host.querySelector<HTMLImageElement>('.galeria__item img')!;
    expect(imagen.alt).toBe('Imagen 1 de la sucursal');
    expect(imagen.src).toBe('https://img.ejemplo/uno.jpg');
    imagen.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(host.textContent).toContain('Imagen no disponible');
    expect(host.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe('No se pudo cargar la imagen 1');
  });

  it('presenta un estado vacío cuando no existen imágenes', () => {
    http.expectOne((request) => request.url.endsWith('/sucursales/12/imagenes')).flush([]);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Todavía no hay imágenes');
  });

  it('sube una imagen y la agrega a la lista', () => {
    http.expectOne((request) => request.url.endsWith('/sucursales/12/imagenes')).flush([]);
    fixture.detectChanges();
    const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('input[type="file"]')!;
    const archivo = new File(['imagen'], 'sucursal.png', { type: 'image/png' });
    Object.defineProperty(input, 'files', { configurable: true, value: [archivo] });
    input.dispatchEvent(new Event('change'));
    const request = http.expectOne((candidate) => candidate.url.endsWith('/sucursales/12/imagenes/upload'));
    expect(request.request.method).toBe('POST');
    expect(request.request.body instanceof FormData).toBe(true);
    expect((request.request.body as FormData).get('file')).toBe(archivo);
    request.flush({ id: 31, url: 'https://img.ejemplo/nueva.png' });
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('.galeria__item')).toHaveLength(1);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('La imagen se agregó');
  });

  it('elimina una imagen y refresca el estado vacío', () => {
    http.expectOne((request) => request.url.endsWith('/sucursales/12/imagenes')).flush([
      { id: 44, url: 'https://img.ejemplo/a.jpg' },
    ]);
    fixture.detectChanges();
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.galeria__quitar')!.click();
    const request = http.expectOne((candidate) => candidate.url.endsWith('/sucursales/12/eliminar/imagen/44'));
    expect(request.request.method).toBe('DELETE');
    request.flush('Se eliminó la imagen de la sucursal');
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Todavía no hay imágenes');
  });

  it('muestra un error inline al fallar la carga inicial', () => {
    http.expectOne((request) => request.url.endsWith('/sucursales/12/imagenes')).flush('error', {
      status: 500,
      statusText: 'Server Error',
    });
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')?.textContent).toContain(
      'No pudimos cargar las imágenes',
    );
  });
});
