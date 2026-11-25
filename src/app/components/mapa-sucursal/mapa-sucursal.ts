import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

import { SucursalDetalleDTO } from '../../models/sucursal';
import { GOOGLE_MAPS_CONFIG } from '../../services/google-maps-service';

const URL_EMBED = 'https://www.google.com/maps/embed/v1';
const CLAVE_EJEMPLO = 'REEMPLAZAR_CON_API_KEY_DE_GOOGLE';
const ZOOM = 16;

/**
 * Mapa embebido del detalle público de una sucursal (US-MAP-05).
 *
 * Usa solo los geodatos que ya trae `SucursalDetalleDTO`: prefiere el Google
 * Place ID y, si no existe, cae en latitud/longitud. No llama a Places,
 * Geocoding ni a Maps JavaScript API, y no hace peticiones al backend.
 *
 * El iframe se crea recién cuando la sección se acerca al viewport: además de
 * `loading="lazy"`, eso evita cualquier carga de Google en la pantalla inicial.
 * Si no hay ubicación, no hay clave configurada o el iframe falla, se muestra
 * un mensaje inline y el resto del detalle sigue funcionando.
 */
@Component({
  selector: 'app-mapa-sucursal',
  imports: [],
  templateUrl: './mapa-sucursal.html',
  styleUrl: './mapa-sucursal.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapaSucursal implements AfterViewInit {
  readonly sucursal = input.required<SucursalDetalleDTO>();

  private readonly config = inject(GOOGLE_MAPS_CONFIG);
  private readonly sanitizador = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);
  private readonly marco = viewChild<ElementRef<HTMLElement>>('marco');

  private readonly falloCarga = signal(false);
  private readonly mostrarMapa = signal(false);
  private observer?: IntersectionObserver;

  private readonly clave = computed(() => {
    const valor = this.config.apiKey?.trim() ?? '';
    return valor && valor !== CLAVE_EJEMPLO && !/\s/.test(valor) ? valor : null;
  });

  private readonly placeId = computed(() => {
    const valor = this.sucursal().googlePlaceId?.trim() ?? '';
    return valor || null;
  });

  private readonly coordenadas = computed(() => {
    const { latitud, longitud } = this.sucursal();
    if (
      typeof latitud !== 'number' ||
      typeof longitud !== 'number' ||
      !Number.isFinite(latitud) ||
      !Number.isFinite(longitud) ||
      latitud < -90 ||
      latitud > 90 ||
      longitud < -180 ||
      longitud > 180
    ) {
      return null;
    }
    return { latitud, longitud };
  });

  protected readonly direccion = computed(() => this.sucursal().direccion?.trim() ?? '');

  protected readonly sinUbicacion = computed(
    () => !this.placeId() && !this.coordenadas(),
  );

  protected readonly sinMapa = computed(() => !this.clave() || this.falloCarga());

  /** La URL se arma con un origen fijo y parámetros codificados por `URL`. */
  protected readonly urlMapa = computed<SafeResourceUrl | null>(() => {
    const clave = this.clave();
    if (!clave || this.sinUbicacion()) {
      return null;
    }

    const placeId = this.placeId();
    const url = placeId
      ? new URL(`${URL_EMBED}/place`)
      : new URL(`${URL_EMBED}/view`);
    url.searchParams.set('key', clave);

    if (placeId) {
      url.searchParams.set('q', `place_id:${placeId}`);
    } else {
      const { latitud, longitud } = this.coordenadas()!;
      url.searchParams.set('center', `${latitud},${longitud}`);
      url.searchParams.set('zoom', String(ZOOM));
    }

    return this.sanitizador.bypassSecurityTrustResourceUrl(url.toString());
  });

  ngAfterViewInit(): void {
    const elemento = this.marco()?.nativeElement;
    if (!elemento) {
      return;
    }

    // jsdom y navegadores sin IntersectionObserver muestran el mapa directamente;
    // loading="lazy" sigue diferiendo la petición real del navegador.
    if (typeof IntersectionObserver === 'undefined') {
      this.mostrarMapa.set(true);
      return;
    }

    this.observer = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((entrada) => entrada.isIntersecting)) {
          this.mostrarMapa.set(true);
          this.observer?.disconnect();
        }
      },
      { rootMargin: '120px' },
    );
    this.observer.observe(elemento);
    this.destroyRef.onDestroy(() => this.observer?.disconnect());
  }
}
