import { RouterLink } from '@angular/router';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  input,
  signal,
  viewChild,
} from '@angular/core';

import { SucursalMiniDTO } from '../../models/sucursal';

/**
 * Carrusel horizontal reutilizable para las secciones del Home.
 * El desplazamiento funciona con rueda horizontal/Shift+rueda, gesto táctil
 * nativo, flechas del componente y teclado cuando el riel tiene el foco.
 */
@Component({
  selector: 'app-carrusel-sucursales',
  imports: [RouterLink],
  templateUrl: './carrusel-sucursales.html',
  styleUrl: './carrusel-sucursales.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CarruselSucursales implements AfterViewInit {
  private readonly trackRef = viewChild<ElementRef<HTMLElement>>('track');

  readonly id = input.required<string>();
  readonly titulo = input.required<string>();
  readonly descripcion = input<string>('');
  readonly sucursales = input.required<readonly SucursalMiniDTO[]>();
  readonly verTodas = input(false);
  readonly etiquetaVerTodas = input('Ver todas las sucursales');

  protected readonly placeholderImage = `data:image/svg+xml;utf8,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="400" height="300" fill="#1a1f2b"/><g fill="none" stroke="#98a2b3" stroke-width="2"><rect x="120" y="80" width="160" height="120" rx="12"/><circle cx="160" cy="120" r="18"/><path d="M120 180l45-40 35 30 30-25 70 60"/></g><text x="200" y="215" text-anchor="middle" fill="#98a2b3" font-size="14" font-family="sans-serif">Sin imagen</text></svg>',
  )}`;

  protected readonly puedeAnterior = signal(false);
  protected readonly puedeSiguiente = signal(false);
  protected readonly ariaLabel = computed(() => `Listado horizontal: ${this.titulo()}`);

  ngAfterViewInit(): void {
    this.actualizarControles();
  }

  @HostListener('window:resize')
  protected alRedimensionar(): void {
    this.actualizarControles();
  }

  protected onWheel(event: WheelEvent): void {
    // No secuestrar el scroll vertical de la página: solo mover el riel cuando
    // el usuario usó rueda horizontal o Shift+rueda.
    if (event.deltaX === 0 && !event.shiftKey) {
      return;
    }

    const track = this.trackRef()?.nativeElement;
    if (!track) {
      return;
    }

    const desplazamiento = event.deltaX !== 0 ? event.deltaX : event.deltaY;
    const alFinal = desplazamiento > 0 &&
      track.scrollLeft + track.clientWidth >= track.scrollWidth - 1;
    const alInicio = desplazamiento < 0 && track.scrollLeft <= 1;
    if (alFinal || alInicio) {
      return;
    }

    event.preventDefault();
    track.scrollLeft += desplazamiento;
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') {
      return;
    }
    event.preventDefault();
    this.mover(event.key === 'ArrowRight' ? 1 : -1);
  }

  protected mover(direccion: 1 | -1): void {
    const track = this.trackRef()?.nativeElement;
    if (!track) {
      return;
    }

    const tarjeta = track.querySelector<HTMLElement>('.carrusel__card');
    const paso = tarjeta ? tarjeta.getBoundingClientRect().width + 16 : track.clientWidth * 0.8;
    const reduceMotion = typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    track.scrollBy({
      left: direccion * paso,
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
    this.actualizarControles();
  }

  protected actualizarControles(): void {
    const track = this.trackRef()?.nativeElement;
    if (!track) {
      return;
    }
    this.puedeAnterior.set(track.scrollLeft > 2);
    this.puedeSiguiente.set(track.scrollLeft + track.clientWidth < track.scrollWidth - 2);
  }

  protected onImageError(event: Event): void {
    (event.target as HTMLImageElement).src = this.placeholderImage;
  }

  protected humanizeCategory(categoria: string): string {
    const texto = categoria.replaceAll('_', ' ').toLocaleLowerCase('es');
    return `${texto.charAt(0).toLocaleUpperCase('es')}${texto.slice(1)}`;
  }

  protected promedio(puntuacion: number | null): string {
    return typeof puntuacion === 'number' && Number.isFinite(puntuacion)
      ? puntuacion.toFixed(1)
      : '0.0';
  }

  protected tieneResenas(sucursal: SucursalMiniDTO): boolean {
    return (sucursal.cantidadPuntuaciones ?? 0) > 0 && sucursal.puntuacion !== null;
  }

  protected ariaTarjeta(sucursal: SucursalMiniDTO): string {
    const base = `${sucursal.nombre}, ${this.humanizeCategory(sucursal.categoria)}`;
    return this.tieneResenas(sucursal)
      ? `${base}, ${this.promedio(sucursal.puntuacion)} de 5, ${sucursal.cantidadPuntuaciones} reseñas. Ver detalle`
      : `${base}, sin reseñas. Ver detalle`;
  }

  protected trackById(_indice: number, sucursal: SucursalMiniDTO): number {
    return sucursal.id;
  }
}
