import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SucursalMiniDTO } from '../../models/sucursal';
import { CarruselSucursales } from './carrusel-sucursales';

const SUCURSAL: SucursalMiniDTO = {
  id: 8,
  nombre: 'Peluquería Flores',
  categoria: 'PELUQUERIA',
  fotoPerfil: null,
  puntuacion: 4.6,
  cantidadPuntuaciones: 12,
};

describe('CarruselSucursales', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CarruselSucursales],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  function crear(verTodas = false) {
    const fixture = TestBed.createComponent(CarruselSucursales);
    fixture.componentRef.setInput('id', 'mejores');
    fixture.componentRef.setInput('titulo', 'Las mejores de AppointMee');
    fixture.componentRef.setInput('sucursales', [SUCURSAL]);
    fixture.componentRef.setInput('verTodas', verTodas);
    fixture.detectChanges();
    return fixture;
  }

  it('renderiza una región accesible con tarjeta enlazada al detalle', () => {
    const fixture = crear();
    const region = fixture.nativeElement.querySelector('.carrusel__track') as HTMLElement;
    const card = fixture.nativeElement.querySelector('.carrusel__card') as HTMLAnchorElement;

    expect(region.getAttribute('role')).toBe('region');
    expect(region.getAttribute('tabindex')).toBe('0');
    expect(region.getAttribute('aria-label')).toContain('Las mejores de AppointMee');
    expect(card.getAttribute('href')).toBe('/sucursal/8');
    expect(card.getAttribute('aria-label')).toContain('4.6 de 5');
    expect(fixture.nativeElement.querySelector('img').getAttribute('src')).toContain(
      'data:image/svg+xml',
    );
  });

  it('muestra «Ver todas» sólo cuando se habilita y apunta al listado', () => {
    const fixture = crear(true);
    const enlace = fixture.nativeElement.querySelector('.carrusel__ver-todas') as HTMLAnchorElement;

    expect(enlace.getAttribute('href')).toBe('/sucursales');
    expect(enlace.textContent).toContain('Ver todas las sucursales');
  });

  it('desplaza el riel con las flechas y actualiza su estado disabled', () => {
    const fixture = crear();
    const track = fixture.nativeElement.querySelector('.carrusel__track') as HTMLElement;
    const scrollBy = vi.fn();
    Object.defineProperty(track, 'scrollBy', { value: scrollBy, configurable: true });
    Object.defineProperty(track, 'scrollWidth', { value: 1200, configurable: true });
    Object.defineProperty(track, 'clientWidth', { value: 300, configurable: true });
    track.dispatchEvent(new Event('scroll'));
    fixture.detectChanges();

    const anterior = fixture.nativeElement.querySelector(
      '.ds-pagination__prev, .carrusel__flecha:first-child',
    ) as HTMLButtonElement;
    const siguiente = fixture.nativeElement.querySelector(
      '.carrusel__flecha:last-child',
    ) as HTMLButtonElement;
    expect(anterior.disabled).toBe(true);
    expect(siguiente.disabled).toBe(false);

    siguiente.click();
    expect(scrollBy).toHaveBeenCalledOnce();
    expect(scrollBy.mock.calls[0][0].left).toBeGreaterThan(0);

    Object.defineProperty(track, 'scrollLeft', { value: 900, configurable: true, writable: true });
    track.dispatchEvent(new Event('scroll'));
    fixture.detectChanges();
    expect(anterior.disabled).toBe(false);
    expect(siguiente.disabled).toBe(true);
  });

  it('mueve el riel con las flechas del teclado', () => {
    const fixture = crear();
    const track = fixture.nativeElement.querySelector('.carrusel__track') as HTMLElement;
    const scrollBy = vi.fn();
    Object.defineProperty(track, 'scrollBy', { value: scrollBy, configurable: true });

    const evento = new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true });
    track.dispatchEvent(evento);

    expect(evento.defaultPrevented).toBe(true);
    expect(scrollBy).toHaveBeenCalledOnce();
  });

  it('sólo intercepta la rueda horizontal para no robar el scroll vertical', () => {
    const fixture = crear();
    const track = fixture.nativeElement.querySelector('.carrusel__track') as HTMLElement;
    let scrollLeft = 0;
    Object.defineProperty(track, 'scrollLeft', {
      get: () => scrollLeft,
      set: (valor: number) => (scrollLeft = valor),
      configurable: true,
    });
    Object.defineProperty(track, 'scrollWidth', { value: 1200, configurable: true });
    Object.defineProperty(track, 'clientWidth', { value: 300, configurable: true });

    const vertical = new Event('wheel', { cancelable: true });
    Object.defineProperty(vertical, 'deltaX', { value: 0 });
    Object.defineProperty(vertical, 'deltaY', { value: 100 });
    Object.defineProperty(vertical, 'shiftKey', { value: false });
    track.dispatchEvent(vertical);

    expect(vertical.defaultPrevented).toBe(false);
    expect(scrollLeft).toBe(0);

    const horizontal = new Event('wheel', { cancelable: true });
    Object.defineProperty(horizontal, 'deltaX', { value: 120 });
    Object.defineProperty(horizontal, 'deltaY', { value: 0 });
    Object.defineProperty(horizontal, 'shiftKey', { value: false });
    track.dispatchEvent(horizontal);

    expect(horizontal.defaultPrevented).toBe(true);
    expect(scrollLeft).toBe(120);
  });
});
