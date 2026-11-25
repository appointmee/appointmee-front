import { DsButtonComponent } from '../../shared/ui/button/button.component';
import { DsInputComponent } from '../../shared/ui/input/input.component';
import { HttpClient, HttpContext } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormField, form, maxLength, minLength, pattern, required } from '@angular/forms/signals';
import { Observable, from, of } from 'rxjs';
import { map } from 'rxjs/operators';

import { SIN_MANEJO_GLOBAL_DE_ERRORES } from '../../http/error-handling-context';
import { backendService } from '../../services/backend-service';
import {
  SugerenciaDireccion,
  UbicacionDireccion,
  googlePlacesService,
} from '../../services/google-places-service';
import { sucursalService } from '../../services/sucursal-service';
import {
  ABREVIATURAS_DIAS,
  CategoriaSucursal,
  DIAS_SUCURSAL,
  SUCURSAL_FORM_VACIO,
  SucursalFormDatos,
  SucursalFormModel,
} from './sucursal-form.model';

/** Estado de un campo del formulario, tal como lo expone el signals forms. */
type EstadoCampo = {
  touched(): boolean;
  invalid(): boolean;
  errors(): readonly { message?: string }[];
};

type CampoHorario = 'horaApertura' | 'horaCierre';

/** No se consulta Places hasta que haya texto suficiente para sugerir. */
const LONGITUD_MINIMA_DIRECCION = 3;
const RETARDO_DEBOUNCE_MS = 350;
const MENSAJE_UBICACION_ALTA =
  'Seleccioná una dirección de las sugerencias para guardar la ubicación.';
const MENSAJE_UBICACION_MODIFICACION =
  'Seleccioná una dirección de las sugerencias para actualizar la ubicación.';

/** Resultado de subir una imagen a Cloudinary. */
interface FotoSubida {
  url: string;
  publicId: string | null;
}

/**
 * Formulario de sucursal compartido por el alta (US-SUC-01) y la
 * modificación (US-SUC-02).
 *
 * Es el único lugar donde viven los campos y sus validaciones: la pantalla de
 * creación y el recuadro de modificación usan este mismo componente, así que
 * las reglas de validación y los mensajes de error son siempre los mismos.
 *
 * El componente no guarda la sucursal: valida, sube la foto si hace falta y
 * emite los datos listos para que la pantalla los envíe a su endpoint.
 */
@Component({
  selector: 'app-sucursal-form',
  imports: [DsButtonComponent, DsInputComponent, FormField],
  templateUrl: './sucursal-form.html',
  styleUrl: './sucursal-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SucursalForm {
  private readonly api = inject(sucursalService);
  private readonly http = inject(HttpClient, { optional: true });
  private readonly backend = inject(backendService, { optional: true });
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly lugares = inject(googlePlacesService);

  /** Modo del formulario: alta o modificación de una sucursal existente. */
  readonly modo = input<'crear' | 'modificar'>('crear');
  /** En el alta la foto es obligatoria; al modificar se conserva la vigente. */
  readonly fotoRequerida = input(true);
  /** Pide confirmación antes de descartar los cambios. */
  readonly confirmarDescarte = input(false);
  /** Errores del backend, por campo. */
  readonly errores = input<Record<string, string>>({});
  /** Error general del formulario (banner inline). */
  readonly errorGeneral = input<string | null>(null);
  /** Hay una operación de guardado en curso. */
  readonly enviando = input(false);
  /** Texto del botón de envío. */
  readonly textoEnviar = input('Crear sucursal');
  /** Texto del botón mientras se guarda. */
  readonly textoGuardando = input('Guardando…');
  /** Valores con los que se precarga el formulario (modo modificación). */
  readonly valoresIniciales = input<SucursalFormModel | null>(null);
  /** Foto vigente de la sucursal (modo modificación). */
  readonly fotoVigente = input<string | null>(null);
  /** Prefijo de los ids de los controles, para que no se repitan. */
  readonly idPrefijo = input('sucursal');

  /** Emite los datos validados, listos para enviar al backend. */
  readonly enviar = output<SucursalFormDatos>();
  /** Emite cuando el usuario descarta el formulario. */
  readonly cancelar = output<void>();

  /** Valores del formulario. */
  readonly model = signal<SucursalFormModel>({ ...SUCURSAL_FORM_VACIO });

  /** Sugerencias de Google Places para el texto escrito por el empleador. */
  protected readonly sugerencias = signal<SugerenciaDireccion[]>([]);
  /** El cargador de Google está preparando el namespace de Places. */
  protected readonly preparandoPlaces = signal(false);
  /** Hay una consulta de Autocomplete en curso. */
  protected readonly buscandoDirecciones = signal(false);
  /** Se está pidiendo el detalle de la sugerencia elegida. */
  protected readonly obteniendoDetalles = signal(false);
  /** Places no se pudo cargar: no se puede ofrecer autocompletado. */
  protected readonly placesNoDisponible = signal(false);
  /** El panel de sugerencias está visible. */
  protected readonly listaAbierta = signal(false);
  /** Sugerencia resaltada con las flechas del teclado. */
  protected readonly indiceActivo = signal(-1);
  /** La última búsqueda no devolvió direcciones. */
  protected readonly sinResultados = signal(false);
  /** Fallo de Places o de la ubicación, recuperable desde el propio campo. */
  protected readonly errorUbicacion = signal<string | null>(null);

  /** Texto que está actualmente en el campo de dirección. */
  private readonly textoDireccion = signal('');
  /** Dirección que corresponde a los datos geográficos guardados en `ubicacion`. */
  private readonly direccionAceptada = signal<string | null>(null);
  private readonly ubicacion = signal<UbicacionDireccion | null>(null);
  private readonly ubicacionInicial = signal<UbicacionDireccion | null>(null);
  private readonly ubicacionCambio = signal(false);
  private ultimaSugerencia: SugerenciaDireccion | null = null;
  private sesion: unknown = null;
  private consultaSugerencias = '';
  private ultimaConsulta = '';
  private temporizadorBusqueda: ReturnType<typeof setTimeout> | null = null;
  private secuenciaBusqueda = 0;

  /** Estado del selector visual para editar apertura o cierre. */
  protected readonly selectorHora = signal<CampoHorario | null>(null);
  protected readonly horaTemporal = signal('09:00');
  protected readonly horasDisponibles = Array.from({ length: 24 }, (_, hora) =>
    String(hora).padStart(2, '0'),
  );
  protected readonly minutosDisponibles = Array.from({ length: 60 }, (_, minuto) =>
    String(minuto).padStart(2, '0'),
  );

  /** Formulario con las validaciones del alta de sucursal. */
  readonly formulario = form(this.model, (campos) => {
    required(campos.nombre, { message: 'Ingresá el nombre de la sucursal.' });
    minLength(campos.nombre, 4, { message: 'El nombre debe tener al menos 4 caracteres.' });
    maxLength(campos.nombre, 120, { message: 'El nombre no puede superar los 120 caracteres.' });

    required(campos.direccion, { message: 'Ingresá la dirección.' });
    // Las reglas históricas siguen vigentes para el texto escrito a mano. Una
    // dirección formateada por Google (o ya guardada) se respeta tal cual: el
    // backend aplica sus propios límites sobre ese valor.
    minLength(campos.direccion, (ctx) => (this.esDireccionAceptada(ctx.value()) ? undefined : 10), {
      message: 'La dirección debe tener al menos 10 caracteres.',
    });
    maxLength(campos.direccion, (ctx) => (this.esDireccionAceptada(ctx.value()) ? undefined : 60), {
      message: 'La dirección no puede superar los 60 caracteres.',
    });
    pattern(
      campos.direccion,
      (ctx) =>
        this.esDireccionAceptada(ctx.value()) ? undefined : /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\d\s.,#-]+$/,
      { message: 'La dirección solo puede contener letras y números.' },
    );

    pattern(campos.telefono, /^\d*$/, { message: 'El teléfono solo puede contener números.' });

    required(campos.descripcion, { message: 'Ingresá la descripción.' });
    minLength(campos.descripcion, 10, { message: 'La descripción debe tener al menos 10 caracteres.' });
    maxLength(campos.descripcion, 1500, {
      message: 'La descripción no puede superar los 1500 caracteres.',
    });

    required(campos.categoria, { message: 'Seleccioná una categoría.' });

    required(campos.horaApertura, { message: 'Ingresá la hora de apertura.' });
    required(campos.horaCierre, { message: 'Ingresá la hora de cierre.' });
  });

  /** Categorías que se pueden elegir, con el id que espera el backend. */
  readonly categorias = signal<CategoriaSucursal[]>([]);

  readonly dias = DIAS_SUCURSAL;
  readonly abreviaturas = ABREVIATURAS_DIAS;

  /** Imagen elegida por el usuario, pendiente de subir. */
  readonly fotoArchivo = signal<File | null>(null);
  /** Vista previa de la imagen elegida. */
  readonly fotoPreview = signal<string | null>(null);
  /** URL de la foto que se debe guardar (la que ya estaba cargada o la nueva). */
  readonly fotoUrl = signal<string | null>(null);
  /** Identificador de la foto en el servidor de imágenes. */
  readonly fotoPublicId = signal<string | null>(null);

  /** El usuario intentó enviar el formulario al menos una vez. */
  readonly intentadoEnviar = signal(false);
  /** Se está subiendo la imagen elegida. */
  readonly subiendoFoto = signal(false);
  /** Se pide confirmación antes de descartar los cambios. */
  readonly confirmacionAbierta = signal(false);

  /** Valores con los que se precargó el formulario, para detectar cambios. */
  private readonly original = signal<SucursalFormModel | null>(null);

  /** El cierre tiene que ser posterior a la apertura. */
  protected readonly horariosInvalidos = computed(() => {
    const apertura = this.model().horaApertura;
    const cierre = this.model().horaCierre;
    return !!(apertura && cierre && !(cierre > apertura));
  });

  /** El formulario se puede enviar cuando todo está completo y válido. */
  protected readonly puedeEnviar = computed(() => {
    if (this.enviando() || this.subiendoFoto()) return false;
    const dias = this.model().diasApertura ?? [];
    if (dias.length === 0) return false;
    if (this.fotoRequerida() && !this.tieneFoto()) return false;
    if (this.formulario().invalid()) return false;
    if (this.horariosInvalidos()) return false;
    // La ubicación se valida al enviar para poder mostrar el error inline.
    return true;
  });

  constructor() {
    this.cargarCategorias();
    this.destroyRef.onDestroy(() => this.cancelarBusquedaPendiente());

    // Precarga: al abrir el formulario de modificación se cargan los datos
    // que ya pertenecen a la sucursal, nunca campos vacíos.
    effect(() => {
      const valores = this.valoresIniciales();
      if (!valores) return;
      const foto = untracked(() => this.fotoVigente());
      this.precargar(valores, foto);
    });
  }

  /** Carga las categorías con su id para que el select use el valor del backend. */
  private cargarCategorias(): void {
    const api = this.api as any;
    if (typeof api?.categoriasConId === 'function') {
      api
        .categoriasConId()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (cats: unknown) => {
            if (Array.isArray(cats)) {
              this.categorias.set(
                cats.map((c: any) => ({
                  id: Number(c?.id),
                  nombre: String(c?.categoria ?? c?.nombre ?? c),
                })),
              );
            } else {
              this.categorias.set([]);
            }
          },
          error: () => this.categorias.set([]),
        });
    } else if (typeof api?.categorias === 'function') {
      api
        .categorias()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (cats: unknown) => {
            this.categorias.set(
              Array.isArray(cats) ? cats.map((c, i) => ({ id: i + 1, nombre: String(c) })) : [],
            );
          },
          error: () => this.categorias.set([]),
        });
    }
  }

  /** Carga en el formulario los datos que ya pertenecen a la sucursal. */
  private precargar(valores: SucursalFormModel, foto: string | null): void {
    const modelo: SucursalFormModel = {
      nombre: valores.nombre ?? '',
      direccion: valores.direccion ?? '',
      telefono: valores.telefono ?? '',
      descripcion: valores.descripcion ?? '',
      categoria: valores.categoria ?? '',
      horaApertura: valores.horaApertura ?? '',
      horaCierre: valores.horaCierre ?? '',
      diasApertura: [...(valores.diasApertura ?? [])],
      latitud: valores.latitud ?? null,
      longitud: valores.longitud ?? null,
      googlePlaceId: valores.googlePlaceId ?? null,
    };

    const ubicacionPrevia = this.ubicacionDesdeModelo(valores);
    this.cancelarBusquedaPendiente();
    this.limpiarSesion();
    this.ubicacion.set(ubicacionPrevia);
    this.ubicacionInicial.set(ubicacionPrevia);
    this.ubicacionCambio.set(false);
    this.direccionAceptada.set(valores.direccion || null);
    this.textoDireccion.set(valores.direccion ?? '');
    this.errorUbicacion.set(null);
    this.placesNoDisponible.set(false);
    this.cerrarPanel();
    this.model.set(modelo);
    this.original.set(modelo);
    this.fotoArchivo.set(null);
    this.fotoPreview.set(null);
    this.fotoUrl.set(null);
    this.fotoPublicId.set(null);
    this.intentadoEnviar.set(false);
    this.confirmacionAbierta.set(false);
    try {
      // Limpia el estado "tocado" de los campos sin borrar los valores.
      this.formulario().reset();
    } catch {
      // ignore
    }
  }

  /** Id de un control del formulario. */
  protected id(campo: string): string {
    return `${this.idPrefijo()}-${campo}`;
  }

  /**
   * Mensaje de error de un campo: primero el que devuelve el backend y, si no
   * hay, el de la validación del cliente. El error recién se muestra cuando
   * el campo fue tocado o cuando se intentó enviar el formulario.
   */
  protected errorDe(campo: string, estado: EstadoCampo): string | null {
    const delBackend = this.errores()[campo];
    if (delBackend) return delBackend;
    if (!estado.invalid()) return null;
    if (!estado.touched() && !this.intentadoEnviar()) return null;
    return estado.errors()[0]?.message ?? null;
  }

  /** Construye la ubicación solo si los tres valores están completos. */
  private ubicacionDesdeModelo(valores: SucursalFormModel): UbicacionDireccion | null {
    const direccion = valores.direccion?.trim() ?? '';
    const googlePlaceId = valores.googlePlaceId?.trim() ?? '';
    const { latitud, longitud } = valores;
    if (
      !direccion ||
      !googlePlaceId ||
      typeof latitud !== 'number' ||
      typeof longitud !== 'number' ||
      !Number.isFinite(latitud) ||
      !Number.isFinite(longitud)
    ) {
      return null;
    }
    return { direccion, latitud, longitud, googlePlaceId };
  }

  /** La dirección actual es la que se guardó o la que devolvió Google Places. */
  private esDireccionAceptada(valor: string | undefined): boolean {
    return !!valor && valor === this.direccionAceptada();
  }

  /** Los datos geográficos que se envían al backend, siempre completos o ausentes. */
  private datosUbicacion(): Pick<
    SucursalFormDatos,
    'latitud' | 'longitud' | 'googlePlaceId'
  > {
    const ubicacion = this.ubicacion();
    if (
      !ubicacion ||
      !this.ubicacionCambio() ||
      this.model().direccion.trim() !== this.direccionAceptada()
    ) {
      return { latitud: null, longitud: null, googlePlaceId: null };
    }
    return {
      latitud: ubicacion.latitud,
      longitud: ubicacion.longitud,
      googlePlaceId: ubicacion.googlePlaceId,
    };
  }

  /**
   * El formulario no puede guardar una dirección sin su ubicación, ni datos
   * geográficos que ya no corresponden al texto visible.
   */
  private ubicacionIncompleta(): boolean {
    const direccion = this.model().direccion.trim();
    if (!direccion) return false;

    const ubicacion = this.ubicacion();
    const aceptada = this.direccionAceptada();
    if (ubicacion) return direccion !== aceptada;

    if (this.modo() === 'crear') return true;
    return direccion !== (this.original()?.direccion.trim() ?? '');
  }

  /** Id del option de sugerencia, para aria-activedescendant. */
  protected idSugerencia(indice: number): string {
    return this.id(`direccion-opcion-${indice}`);
  }

  private cancelarBusquedaPendiente(): void {
    if (this.temporizadorBusqueda !== null) {
      clearTimeout(this.temporizadorBusqueda);
      this.temporizadorBusqueda = null;
    }
    this.preparandoPlaces.set(false);
  }

  /** Cierra el panel sin tocar la dirección ni los datos geográficos. */
  private cerrarPanel(): void {
    this.listaAbierta.set(false);
    this.sugerencias.set([]);
    this.sinResultados.set(false);
    this.indiceActivo.set(-1);
  }

  /** Cada búsqueda usa una sesión nueva; los detalles deben usar la misma. */
  private limpiarSesion(): void {
    this.sesion = null;
    this.consultaSugerencias = '';
    this.ultimaSugerencia = null;
  }

  /** Al volver a la dirección original se recupera su ubicación sin consultar. */
  private restaurarUbicacionInicial(): void {
    this.ubicacion.set(this.ubicacionInicial());
    this.direccionAceptada.set(this.original()?.direccion || null);
    this.ubicacionCambio.set(false);
    this.limpiarSesion();
    this.ultimaConsulta = '';
  }

  /** El empleador escribió en el campo de dirección. */
  protected onDireccionInput(event: Event): void {
    const texto = (event.target as HTMLInputElement).value;
    this.textoDireccion.set(texto);
    this.cancelarBusquedaPendiente();
    this.errorUbicacion.set(null);
    this.placesNoDisponible.set(false);
    this.sinResultados.set(false);
    this.indiceActivo.set(-1);
    this.ultimaSugerencia = null;

    const limpio = texto.trim();
    if (limpio && limpio === this.original()?.direccion.trim()) {
      this.restaurarUbicacionInicial();
      this.cerrarPanel();
      return;
    }
    if (limpio && limpio === this.direccionAceptada() && this.ubicacion()) {
      this.cerrarPanel();
      return;
    }

    if (limpio.length < LONGITUD_MINIMA_DIRECCION) {
      this.cerrarPanel();
      this.limpiarSesion();
      this.ultimaConsulta = '';
      return;
    }

    // Debounce: una sola consulta por pausa de escritura, nunca por tecla.
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

  /** Pide sugerencias solo cuando cambió el texto o el usuario reintentó. */
  private async buscarDirecciones(texto: string, fuerza: boolean): Promise<void> {
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
            'Google Places no está disponible. Seguí escribiendo la dirección o intentá de nuevo.',
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
          : 'No pudimos buscar direcciones en este momento. Podés seguir escribiendo o intentar de nuevo.',
      );
      this.cerrarPanel();
    } finally {
      if (secuencia === this.secuenciaBusqueda) this.buscandoDirecciones.set(false);
    }
  }

  /** Elige una sugerencia: recién ahí se piden los detalles con la misma sesión. */
  protected seleccionarSugerencia(indice: number): void {
    const sugerencia = this.sugerencias()[indice];
    const token = this.sesion;
    if (!sugerencia || !token || this.obteniendoDetalles()) return;
    if (this.textoDireccion().trim() !== this.consultaSugerencias) {
      this.cerrarPanel();
      return;
    }
    this.obtenerDetalles(sugerencia, token);
  }

  private obtenerDetalles(sugerencia: SugerenciaDireccion, token: unknown): void {
    const secuencia = ++this.secuenciaBusqueda;
    const consulta = this.consultaSugerencias;
    this.buscandoDirecciones.set(false);
    this.obteniendoDetalles.set(true);
    this.errorUbicacion.set(null);

    void (async () => {
      try {
        const ubicacion = await this.lugares.obtenerDetalles(sugerencia, token);
        if (secuencia !== this.secuenciaBusqueda || this.textoDireccion().trim() !== consulta) {
          return;
        }
        this.direccionAceptada.set(ubicacion.direccion);
        this.ubicacion.set(ubicacion);
        this.ubicacionCambio.set(true);
        this.textoDireccion.set(ubicacion.direccion);
        this.model.update((actual) => ({ ...actual, direccion: ubicacion.direccion }));
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

  /** Reintenta la última operación de Places sin cerrar el formulario. */
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

  /** Marca o desmarca un día de apertura. */
  protected alternarDia(dia: string): void {
    const actuales = this.model().diasApertura ?? [];
    const nuevos = actuales.includes(dia)
      ? actuales.filter((d) => d !== dia)
      : [...actuales, dia];
    this.model.update((m) => ({ ...m, diasApertura: nuevos }));
  }

  /** El día está marcado como día de apertura. */
  protected diaSeleccionado(dia: string): boolean {
    return (this.model().diasApertura ?? []).includes(dia);
  }

  /** Abre el selector propio, precargado con la hora actual o un valor sugerido. */
  protected abrirSelectorHora(campo: CampoHorario): void {
    const predeterminada = campo === 'horaApertura' ? '09:00' : '18:00';
    this.horaTemporal.set(this.model()[campo] || predeterminada);
    this.selectorHora.set(campo);
    afterNextRender(() => this.host.nativeElement
      .querySelector<HTMLSelectElement>(`#${this.id(campo + '-selector')} select`)?.focus(), {
        injector: this.injector,
      });
  }

  /** Actualiza hora o minuto del selector temporal sin modificar el formulario aún. */
  protected actualizarHoraTemporal(parte: 'hora' | 'minuto', event: Event): void {
    const valor = (event.target as HTMLSelectElement).value;
    const [hora, minuto] = this.horaTemporal().split(':');
    this.horaTemporal.set(parte === 'hora' ? `${valor}:${minuto ?? '00'}` : `${hora ?? '09'}:${valor}`);
  }

  /** Obtiene la parte de hora o minuto para los selectores separados. */
  protected horaTemporalParte(parte: 'hora' | 'minuto'): string {
    return this.horaTemporal().split(':')[parte === 'hora' ? 0 : 1] ?? '00';
  }

  /** Aplica la selección al formulario y devuelve el foco al control que la abrió. */
  protected confirmarHora(): void {
    const campo = this.selectorHora();
    if (!campo) return;
    this.model.update((actual) => ({ ...actual, [campo]: this.horaTemporal() }));
    if (campo === 'horaApertura') this.formulario.horaApertura().markAsTouched();
    else this.formulario.horaCierre().markAsTouched();
    this.cerrarSelectorHora();
  }

  /** Cierra el selector sin aplicar y devuelve el foco al botón disparador. */
  protected cerrarSelectorHora(): void {
    const campo = this.selectorHora();
    if (!campo) return;
    this.selectorHora.set(null);
    afterNextRender(() => this.host.nativeElement
      .querySelector<HTMLButtonElement>(`#${this.id(campo + '-selector-trigger')}`)?.focus(), {
        injector: this.injector,
      });
  }

  /** La sucursal tiene foto: la vigente, la ya cargada o la elegida. */
  protected tieneFoto(): boolean {
    return this.fotoUrl() !== null || this.fotoArchivo() !== null || this.fotoVigente() !== null;
  }

  /** Guarda la imagen elegida por el usuario. */
  protected onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (!file) return;
    this.fotoArchivo.set(file);
    this.fotoUrl.set(null);
    this.fotoPublicId.set(null);
    const reader = new FileReader();
    reader.onload = () => this.fotoPreview.set(String(reader.result ?? ''));
    reader.readAsDataURL(file);
  }

  /** Id de la categoría elegida, tal como lo espera el backend. */
  protected categoriaIdDe(nombre: string): number {
    const cat = this.categorias().find((c) => c.nombre === nombre);
    return cat ? cat.id : 1;
  }

  /** El formulario tiene cambios respecto de los valores con los que se abrió. */
  tieneCambios(): boolean {
    const original = this.original();
    if (!original) return false;
    const actual = this.model();
    if (actual.nombre.trim() !== original.nombre.trim()) return true;
    if (actual.direccion.trim() !== original.direccion.trim()) return true;
    if (actual.telefono.trim() !== original.telefono.trim()) return true;
    if (actual.descripcion.trim() !== original.descripcion.trim()) return true;
    if (actual.categoria !== original.categoria) return true;
    if (actual.horaApertura !== original.horaApertura) return true;
    if (actual.horaCierre !== original.horaCierre) return true;
    if (actual.diasApertura.join(',') !== original.diasApertura.join(',')) return true;
    if (this.ubicacionCambio()) return true;
    if (this.fotoArchivo() !== null) return true;
    return false;
  }

  /**
   * Cierra el formulario. Si hubo cambios se pide confirmación antes de
   * descartarlos; si no, se cierra directamente.
   */
  solicitarCierre(): void {
    if (this.enviando() || this.subiendoFoto()) return;

    if (this.confirmarDescarte() && this.tieneCambios()) {
      this.confirmacionAbierta.set(true);
      return;
    }

    this.cancelar.emit();
  }

  /** Vuelve al formulario sin descartar los cambios. */
  protected seguirEditando(): void {
    this.confirmacionAbierta.set(false);
  }

  /** Descarta los cambios y cierra el formulario. */
  protected descartarCambios(): void {
    this.confirmacionAbierta.set(false);
    this.cancelar.emit();
  }

  /** Envía el formulario: valida los datos y los emite para guardarlos. */
  protected onSubmit(event: Event): void {
    event.preventDefault();
    this.enviarFormulario();
  }

  /**
   * Valida el formulario y, si está todo bien, emite los datos para que la
   * pantalla los envíe al backend.
   */
  enviarFormulario(): void {
    if (this.enviando() || this.subiendoFoto()) return;

    this.intentadoEnviar.set(true);
    this.formulario().markAsTouched();

    const dias = this.model().diasApertura ?? [];
    const faltaFoto = this.fotoRequerida() && !this.tieneFoto();
    const faltaUbicacion = this.ubicacionIncompleta();
    if (faltaUbicacion) {
      this.errorUbicacion.set(
        this.modo() === 'crear' ? MENSAJE_UBICACION_ALTA : MENSAJE_UBICACION_MODIFICACION,
      );
    }

    if (
      this.formulario().invalid() ||
      dias.length === 0 ||
      faltaFoto ||
      this.horariosInvalidos() ||
      faltaUbicacion
    ) {
      this.enfocarPrimerCampoInvalido();
      return;
    }

    this.prepararEnvio()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((datos) => this.enviar.emit(datos));
  }

  /** Sube la foto elegida (si hay) y arma los datos de la sucursal. */
  private prepararEnvio(): Observable<SucursalFormDatos> {
    const archivo = this.fotoArchivo();
    if (!archivo) {
      // Sin foto nueva: en el alta se usa la URL ya cargada y en la
      // modificación se conserva la foto vigente de la sucursal.
      return of(this.construirDatos(this.fotoUrl(), this.fotoPublicId()));
    }

    this.subiendoFoto.set(true);
    return this.subirFoto(archivo).pipe(
      map((subida) => {
        this.subiendoFoto.set(false);
        return this.construirDatos(subida.url, subida.publicId);
      }),
    );
  }

  /** Normaliza los valores del formulario para mandarlos al backend. */
  private construirDatos(fotoUrl: string | null, fotoPublicId: string | null): SucursalFormDatos {
    const actual = this.model();
    return {
      nombre: actual.nombre.trim(),
      direccion: actual.direccion.trim() || null,
      telefono: actual.telefono.trim() || null,
      descripcion: actual.descripcion.trim() || null,
      horaApertura: actual.horaApertura.trim() || null,
      horaCierre: actual.horaCierre.trim() || null,
      diasApertura: [...(actual.diasApertura ?? [])],
      categoriaId: this.categoriaIdDe(actual.categoria),
      fotoUrl,
      fotoPublicId,
      ...this.datosUbicacion(),
    };
  }

  /** Sube la imagen elegida al servidor de imágenes. */
  private subirFoto(archivo: File): Observable<FotoSubida> {
    const api = this.api as any;
    const candidatos = [
      'subirImagen',
      'subirFoto',
      'subirImagenCloudinary',
      'uploadImage',
      'upload',
    ];
    for (const nombre of candidatos) {
      if (typeof api?.[nombre] === 'function') {
        try {
          const resultado = api[nombre](archivo, 'SUCURSAL');
          if (resultado && typeof resultado.subscribe === 'function') {
            return resultado as Observable<any>;
          }
          if (resultado && typeof resultado.then === 'function') {
            return from(resultado) as Observable<any>;
          }
        } catch {
          // probar siguiente opción
        }
      }
    }

    if (!this.http || !this.backend) {
      return of({ url: '', publicId: null });
    }

    const formData = new FormData();
    formData.append('file', archivo);
    return this.http
      .post<any>(`${this.backend.baseUrl}/imagenes/upload?tipo=SUCURSAL`, formData, {
        context: new HttpContext().set(SIN_MANEJO_GLOBAL_DE_ERRORES, true),
      })
      .pipe(
        map((res: any) => ({
          url: String(res?.url ?? res?.secure_url ?? ''),
          publicId: res?.publicId ?? res?.public_id ?? null,
        })),
      );
  }

  /**
   * Mueve el foco al primer campo inválido para que el usuario sepa dónde
   * corregir. No cambia el estado del formulario.
   */
  private enfocarPrimerCampoInvalido(): void {
    const campos = [
      this.formulario.nombre,
      this.formulario.direccion,
      this.formulario.descripcion,
      this.formulario.categoria,
      this.formulario.horaApertura,
      this.formulario.horaCierre,
      this.formulario.telefono,
    ];

    for (const campo of campos) {
      if (!campo().invalid()) continue;
      try {
        campo().focusBoundControl();
      } catch {
        // El campo puede no tener un control nativo asociado.
      }
      return;
    }

    if (this.errorUbicacion()) {
      try {
        this.host.nativeElement
          .querySelector<HTMLInputElement>(`#${this.id('direccion')}`)
          ?.focus();
      } catch {
        // El campo puede no estar montado.
      }
    }
  }
}
