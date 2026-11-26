import { DsButtonComponent } from '../../shared/ui/button/button.component';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

import {
  SolicitudEmpleadorCrearDTO,
  UbicacionSolicitudEmpleadorDTO,
} from '../../models/solicitud-empleador';
import {
  SugerenciaDireccion,
  UbicacionDireccion,
  googlePlacesService,
} from '../../services/google-places-service';

const MINIMO_CARACTERES = 20;
const MAXIMO_CARACTERES = 300;
const MAXIMO_UBICACIONES = 10;
const LONGITUD_MINIMA_DIRECCION = 3;
const RETARDO_DEBOUNCE_MS = 350;

interface ErrorFormulario {
  readonly id: string;
  readonly mensaje: string;
}

/**
 * Formulario de solicitud de empleador. Reutiliza `googlePlacesService`
 * (US-MAP-04): una sesión por búsqueda, una consulta de Autocomplete por pausa
 * de escritura y un único `fetchFields` por sugerencia aceptada.
 */
@Component({
  selector: 'app-solicitud-empleador-modal',
  templateUrl: './solicitud-empleador-modal.html',
  styleUrl: './solicitud-empleador-modal.css',
  imports: [DsButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SolicitudEmpleadorModal {
  readonly enviando = input(false);
  readonly error = input<string | null>(null);

  readonly cerrar = output<void>();
  readonly confirmar = output<SolicitudEmpleadorCrearDTO>();
  readonly limpiarError = output<void>();

  protected readonly minimo = MINIMO_CARACTERES;
  protected readonly maximo = MAXIMO_CARACTERES;
  protected readonly maximoUbicaciones = MAXIMO_UBICACIONES;
  protected readonly motivo = signal('');
  protected readonly tocado = signal(false);

  protected readonly ubicaciones = signal<readonly UbicacionSolicitudEmpleadorDTO[]>([]);
  protected readonly sugerencias = signal<readonly SugerenciaDireccion[]>([]);
  protected readonly preparandoPlaces = signal(false);
  protected readonly buscandoDirecciones = signal(false);
  protected readonly obteniendoDetalles = signal(false);
  protected readonly placesNoDisponible = signal(false);
  protected readonly listaAbierta = signal(false);
  protected readonly indiceActivo = signal(-1);
  protected readonly sinResultados = signal(false);
  protected readonly errorUbicacion = signal<string | null>(null);
  protected readonly infoUbicacion = signal<string | null>(null);

  protected readonly caracteres = computed(() => this.motivo().trim().length);
  protected readonly motivoValido = computed(
    () => this.caracteres() >= MINIMO_CARACTERES && this.caracteres() <= MAXIMO_CARACTERES,
  );
  protected readonly puedeAgregar = computed(
    () => this.ubicaciones().length < MAXIMO_UBICACIONES && !this.enviando(),
  );
  protected readonly valido = computed(
    () => this.motivoValido() && this.ubicaciones().length >= 1,
  );
  protected readonly puedeEnviar = computed(() => this.valido() && !this.enviando());
  protected readonly mostrarAyudaValidacion = computed(() => this.tocado() && !this.motivoValido());
  protected readonly mostrarErrorUbicaciones = computed(
    () => this.tocado() && this.ubicaciones().length === 0,
  );
  protected readonly errores = computed<readonly ErrorFormulario[]>(() => {
    if (!this.tocado()) return [];
    const errores: ErrorFormulario[] = [];
    if (!this.motivoValido()) {
      errores.push({ id: 'solicitud-motivo', mensaje: 'Revisá el comentario.' });
    }
    if (this.ubicaciones().length === 0) {
      errores.push({ id: 'solicitud-direccion', mensaje: 'Agregá al menos una ubicación.' });
    }
    return errores;
  });
  protected readonly ubicacionesCompletas = computed(() => this.ubicaciones().length === MAXIMO_UBICACIONES);

  private readonly destroyRef = inject(DestroyRef);
  private readonly lugares = inject(googlePlacesService);
  private readonly dialogo = viewChild.required<ElementRef<HTMLDialogElement>>('dialogo');
  private readonly textarea = viewChild<ElementRef<HTMLTextAreaElement>>('textarea');
  private readonly direccion = viewChild<ElementRef<HTMLInputElement>>('direccion');

  protected readonly textoDireccion = signal('');
  private sesion: unknown = null;
  private consultaSugerencias = '';
  private ultimaConsulta = '';
  private ultimaSugerencia: SugerenciaDireccion | null = null;
  private temporizadorBusqueda: ReturnType<typeof setTimeout> | null = null;
  private secuenciaBusqueda = 0;

  constructor() {
    afterNextRender(() => {
      document.body.classList.add('modal-abierto');
      this.dialogo().nativeElement.showModal();
      this.textarea()?.nativeElement.focus();
    });

    this.destroyRef.onDestroy(() => {
      document.body.classList.remove('modal-abierto');
      this.cancelarBusquedaPendiente();
    });
  }

  protected actualizarMotivo(event: Event): void {
    const valor = (event.target as HTMLTextAreaElement).value;
    this.motivo.set(valor);

    if (this.error()) {
      this.limpiarError.emit();
    }
  }

  protected idSugerencia(indice: number): string {
    return `solicitud-direccion-opcion-${indice}`;
  }

  private cancelarBusquedaPendiente(): void {
    if (this.temporizadorBusqueda !== null) {
      clearTimeout(this.temporizadorBusqueda);
      this.temporizadorBusqueda = null;
    }
    this.preparandoPlaces.set(false);
  }

  /** Cierra el panel sin alterar la lista de ubicaciones ya elegidas. */
  private cerrarPanel(): void {
    this.listaAbierta.set(false);
    this.sugerencias.set([]);
    this.sinResultados.set(false);
    this.indiceActivo.set(-1);
  }

  private limpiarSesion(): void {
    this.sesion = null;
    this.consultaSugerencias = '';
    this.ultimaSugerencia = null;
  }

  /** El usuario escribió en el buscador de direcciones. */
  protected onDireccionInput(event: Event): void {
    const texto = (event.target as HTMLInputElement).value;
    this.textoDireccion.set(texto);
    this.cancelarBusquedaPendiente();
    this.errorUbicacion.set(null);
    this.infoUbicacion.set(null);
    this.placesNoDisponible.set(false);
    this.sinResultados.set(false);
    this.indiceActivo.set(-1);
    this.ultimaSugerencia = null;

    const limpio = texto.trim();
    if (limpio.length < LONGITUD_MINIMA_DIRECCION) {
      this.cerrarPanel();
      this.limpiarSesion();
      this.ultimaConsulta = '';
      return;
    }

    // No repetir la facturación de una consulta idéntica ya hecha en la sesión.
    if (limpio === this.ultimaConsulta && this.sesion) {
      this.cerrarPanel();
      return;
    }

    this.temporizadorBusqueda = setTimeout(() => {
      this.temporizadorBusqueda = null;
      void this.buscarDirecciones(limpio, false);
    }, RETARDO_DEBOUNCE_MS);
  }

  /** Navegación accesible del combobox con flechas, Enter y Escape. */
  protected onDireccionKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.cerrarPanel();
      return;
    }

    const total = this.sugerencias().length;
    if (!total) return;

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const actual = this.indiceActivo();
      const siguiente =
        event.key === 'ArrowDown' ? (actual + 1) % total : actual <= 0 ? total - 1 : actual - 1;
      this.indiceActivo.set(siguiente);
      this.listaAbierta.set(true);
      return;
    }

    if (event.key === 'Enter' && this.indiceActivo() >= 0) {
      event.preventDefault();
      this.seleccionarSugerencia(this.indiceActivo());
    }
  }

  private async buscarDirecciones(texto: string, fuerza: boolean): Promise<void> {
    if (!this.puedeAgregar()) return;
    if (!fuerza && texto === this.ultimaConsulta && this.sesion) return;

    const secuencia = ++this.secuenciaBusqueda;
    this.ultimaConsulta = texto;
    this.buscandoDirecciones.set(true);
    this.errorUbicacion.set(null);
    this.sinResultados.set(false);
    this.sugerencias.set([]);
    this.indiceActivo.set(-1);

    try {
      if (!this.sesion) {
        this.preparandoPlaces.set(true);
        try {
          this.sesion = await this.lugares.iniciarSesion();
          this.placesNoDisponible.set(false);
        } catch {
          this.placesNoDisponible.set(true);
          this.errorUbicacion.set(
            'Google Places no está disponible. Probá de nuevo en unos instantes.',
          );
          this.cerrarPanel();
          return;
        } finally {
          this.preparandoPlaces.set(false);
        }
      }
      if (secuencia !== this.secuenciaBusqueda) return;

      const encontradas = await this.lugares.buscar(texto, this.sesion);
      if (secuencia !== this.secuenciaBusqueda) return;

      this.consultaSugerencias = texto;
      this.sugerencias.set(encontradas);
      this.sinResultados.set(encontradas.length === 0);
      this.listaAbierta.set(encontradas.length > 0);
    } catch (error) {
      if (secuencia !== this.secuenciaBusqueda) return;
      const detalle = error instanceof Error ? error.message : '';
      this.errorUbicacion.set(
        this.lugares.fallo()
          ? `Google Places no está disponible. ${detalle}`
          : 'No pudimos buscar direcciones en este momento. Podés intentar de nuevo.',
      );
      this.cerrarPanel();
    } finally {
      if (secuencia === this.secuenciaBusqueda) this.buscandoDirecciones.set(false);
    }
  }

  /** Solo se acepta una sugerencia válida de Google Places, nunca texto libre. */
  protected seleccionarSugerencia(indice: number): void {
    const sugerencia = this.sugerencias()[indice];
    const token = this.sesion;
    if (!sugerencia || !token || this.obteniendoDetalles() || !this.puedeAgregar()) return;
    if (this.textoDireccion().trim() !== this.consultaSugerencias) {
      this.cerrarPanel();
      return;
    }

    // No pedir detalles (operación facturable) para una dirección ya agregada.
    if (this.ubicaciones().some((ubicacion) => ubicacion.googlePlaceId === sugerencia.id)) {
      this.yaAgregada();
      return;
    }

    this.obtenerDetalles(sugerencia, token);
  }

  private yaAgregada(): void {
    this.cerrarPanel();
    this.limpiarSesion();
    this.ultimaConsulta = '';
    this.textoDireccion.set('');
    this.infoUbicacion.set('Esa ubicación ya está en la lista.');
  }

  private obtenerDetalles(sugerencia: SugerenciaDireccion, token: unknown): void {
    const secuencia = ++this.secuenciaBusqueda;
    const consulta = this.consultaSugerencias;
    this.buscandoDirecciones.set(false);
    this.obteniendoDetalles.set(true);
    this.errorUbicacion.set(null);
    this.infoUbicacion.set(null);

    void (async () => {
      try {
        const ubicacion: UbicacionDireccion = await this.lugares.obtenerDetalles(sugerencia, token);
        if (secuencia !== this.secuenciaBusqueda || this.textoDireccion().trim() !== consulta) {
          return;
        }
        if (
          this.ubicaciones().some(
            (actual) => actual.googlePlaceId === ubicacion.googlePlaceId,
          )
        ) {
          this.yaAgregada();
          return;
        }
        if (this.ubicaciones().length >= MAXIMO_UBICACIONES) {
          this.cerrarPanel();
          return;
        }

        this.ubicaciones.update((actuales) => [...actuales, { ...ubicacion }]);
        this.textoDireccion.set('');
        this.limpiarSesion();
        this.ultimaConsulta = '';
        this.cerrarPanel();
      } catch {
        if (secuencia !== this.secuenciaBusqueda) return;
        this.ultimaSugerencia = sugerencia;
        this.errorUbicacion.set(
          'No pudimos obtener los datos completos de la dirección. Podés elegir otra sugerencia o intentar de nuevo.',
        );
      } finally {
        if (secuencia === this.secuenciaBusqueda) this.obteniendoDetalles.set(false);
      }
    })();
  }

  /** Reintenta la última operación de Places sin iniciar una búsqueda nueva. */
  protected reintentarUbicacion(): void {
    if (this.obteniendoDetalles() || this.buscandoDirecciones()) return;
    const sugerencia = this.ultimaSugerencia;
    const token = this.sesion;
    if (sugerencia && token) {
      this.ultimaSugerencia = null;
      this.obtenerDetalles(sugerencia, token);
      return;
    }
    const texto = this.textoDireccion().trim();
    if (texto.length >= LONGITUD_MINIMA_DIRECCION) void this.buscarDirecciones(texto, true);
  }

  protected eliminarUbicacion(indice: number): void {
    this.ubicaciones.update((actuales) => actuales.filter((_, posicion) => posicion !== indice));
    this.infoUbicacion.set(null);
  }

  protected enviar(event: Event): void {
    event.preventDefault();
    this.tocado.set(true);

    if (!this.puedeEnviar()) {
      if (!this.motivoValido()) {
        this.textarea()?.nativeElement.focus();
      } else {
        this.direccion()?.nativeElement.focus();
      }
      return;
    }

    this.confirmar.emit({
      motivo: this.motivo().trim(),
      ubicaciones: this.ubicaciones().map((ubicacion) => ({ ...ubicacion })),
    });
  }

  protected cerrarModal(): void {
    if (this.enviando()) return;
    this.cerrar.emit();
  }

  protected cancelar(event: Event): void {
    event.preventDefault();
    this.cerrarModal();
  }

  protected clickEnFondo(event: MouseEvent): void {
    if (event.target === this.dialogo().nativeElement) {
      this.cerrarModal();
    }
  }
}
