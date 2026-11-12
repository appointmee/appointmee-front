import { DsButtonComponent } from '../../shared/ui/button/button.component';
import { DsInputComponent } from '../../shared/ui/input/input.component';
import { DsModalComponent } from '../../shared/ui/misc/misc.component';
import { HttpClient, HttpContext } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostBinding,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormField,
  form,
  maxLength,
  min,
  max,
  minLength,
  pattern,
  required,
  validate,
} from '@angular/forms/signals';
import { Observable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

import { SIN_MANEJO_GLOBAL_DE_ERRORES } from '../../http/error-handling-context';
import { ServicioDTO, ServicioModificarPayload } from '../../models/servicio';
import { backendService } from '../../services/backend-service';
import { servicioService } from '../../services/servicio-service';
import { mapearErroresFormulario } from '../../shared/errores-formulario';

/** Valores que maneja el formulario de modificación. */
interface EditarServicioModel {
  nombre: string;
  descripcion: string;
  duracion: number | null;
  precio: number | null;
}

/** Resultado de subir una imagen nueva a Cloudinary. */
interface FotoSubida {
  url: string;
  publicId: string | null;
}

/**
 * Formulario de modificación de un servicio (US-SERV-02).
 *
 * Se abre por encima del modal de detalle y reutiliza las mismas validaciones
 * que la creación de servicios (US-SERV-01). El backend solo aplica los
 * campos que llegan en la petición, así que se envían únicamente los que el
 * empleador modificó; el resto conserva su valor actual.
 */
@Component({
  selector: 'app-servicio-editar-modal',
  imports: [DsButtonComponent, DsInputComponent, DsModalComponent, FormField],
  templateUrl: './servicio-editar-modal.html',
  styleUrl: './servicio-editar-modal.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServicioEditarModal {
  private readonly api = inject(servicioService);
  private readonly http = inject(HttpClient, { optional: true });
  private readonly backend = inject(backendService, { optional: true });
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  /** Servicio que se está modificando. */
  readonly servicio = input<ServicioDTO | null>(null);
  /** Define si el formulario está visible. */
  readonly abierto = input(false);
  /** Se emite cuando el usuario quiere cerrar el formulario. */
  readonly cerrar = output<void>();
  /** Se emite cuando el backend confirmó la modificación del servicio. */
  readonly actualizado = output<void>();

  protected readonly model = signal<EditarServicioModel>({
    nombre: '',
    descripcion: '',
    duracion: null,
    precio: null,
  });
  /** Valores con los que se precargó el formulario, para detectar cambios. */
  private readonly original = signal<EditarServicioModel | null>(null);

  protected readonly fotoArchivo = signal<File | null>(null);
  protected readonly fotoPreview = signal<string | null>(null);
  protected readonly fotoActual = signal<string | null>(null);

  protected readonly guardando = signal(false);
  protected readonly subiendoFoto = signal(false);
  protected readonly errorGeneral = signal<string | null>(null);
  protected readonly intentadoEnviar = signal(false);
  protected readonly erroresBackend = signal<Record<string, string>>({});
  /** Confirmación de descarte: se muestra antes de perder los cambios. */
  protected readonly confirmacionAbierta = signal(false);

  protected readonly formulario = form(this.model, (campos) => {
    required(campos.nombre, { message: 'Ingresá el nombre del servicio.' });
    minLength(campos.nombre, 4, { message: 'El nombre debe tener al menos 4 caracteres.' });
    maxLength(campos.nombre, 60, { message: 'El nombre no puede superar los 60 caracteres.' });
    pattern(campos.nombre, /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s,-]+$/, {
      message: 'El nombre solo puede tener letras y espacios.',
    });

    required(campos.descripcion, { message: 'Ingresá la descripción.' });
    minLength(campos.descripcion, 10, { message: 'La descripción debe tener al menos 10 caracteres.' });
    maxLength(campos.descripcion, 500, { message: 'La descripción no puede superar los 500 caracteres.' });

    required(campos.duracion, { message: 'Ingresá la duración en minutos.' });
    min(campos.duracion, 30, { message: 'La duración mínima es de 30 minutos.' });
    max(campos.duracion, 360, { message: 'La duración máxima es de 360 minutos (6 horas).' });
    // Ojo: en el contexto de validación `value` es una signal, hay que invocarla
    // para obtener el valor. Si se desestructura sin llamarla, el validador
    // recibe la propia signal y rechaza cualquier número válido.
    validate(campos.duracion, (contexto) => {
      const duracion = contexto.value();
      if (duracion === null || duracion === undefined) return null;
      if (!Number.isInteger(duracion)) {
        return { kind: 'integer', message: 'La duración debe ser un número entero de minutos.' };
      }
      // El backend solo acepta duraciones en intervalos de 30 minutos.
      if (duracion % 30 !== 0) {
        return {
          kind: 'intervalo',
          message: 'La duración debe ser un múltiplo de 30 minutos (30, 60, 90…).',
        };
      }
      return null;
    });

    required(campos.precio, { message: 'Ingresá el precio del servicio.' });
    min(campos.precio, 0.01, { message: 'El precio mínimo es 0.01.' });
    max(campos.precio, 999999.99, { message: 'El precio máximo es 999999.99.' });
    validate(campos.precio, (contexto) => {
      const precio = contexto.value();
      if (precio === null || precio === undefined) return null;
      // Se compara contra el precio redondeado a centavos para no depender de la
      // representación binaria de los decimales (0.29 * 100 !== 29).
      return Number(precio.toFixed(2)) === precio
        ? null
        : { kind: 'digits', message: 'El precio debe tener a lo sumo 2 decimales.' };
    });
  });

  /** Errores por campo: el mensaje del backend tiene prioridad sobre el local. */
  protected readonly erroresCampos = computed(() => {
    const backend = this.erroresBackend();
    return {
      nombre: this.mensajeDeCampo(this.formulario.nombre(), backend['nombre'], 'Revisá el nombre del servicio.'),
      descripcion: this.mensajeDeCampo(
        this.formulario.descripcion(),
        backend['descripcion'],
        'Revisá la descripción del servicio.',
      ),
      duracion: this.mensajeDeCampo(
        this.formulario.duracion(),
        backend['duracion'],
        'Ingresá una duración válida en minutos.',
      ),
      precio: this.mensajeDeCampo(this.formulario.precio(), backend['precio'], 'Ingresá un precio válido.'),
    };
  });

  protected readonly errorNombre = computed(() => this.erroresCampos().nombre);
  protected readonly errorDescripcion = computed(() => this.erroresCampos().descripcion);
  protected readonly errorDuracion = computed(() => this.erroresCampos().duracion);
  protected readonly errorPrecio = computed(() => this.erroresCampos().precio);

  protected readonly errorFoto = computed(() => {
    const backend = this.erroresBackend()['foto'] ?? this.erroresBackend()['fotoUrl'] ?? null;
    if (backend) return backend;
    const archivo = this.fotoArchivo();
    if (archivo) {
      if (archivo.size > 5 * 1024 * 1024) return 'La imagen no puede superar los 5 MB.';
      if (!/^image\/(jpeg|png|webp|gif)$/i.test(archivo.type))
        return 'El archivo debe ser una imagen JPG, PNG, WEBP o GIF.';
    }
    return null;
  });

  /** Vista previa de la foto: la nueva si se eligió una, si no la actual. */
  protected readonly vistaPrevia = computed(() => this.fotoPreview() ?? this.fotoActual());

  /** Indica si los valores del formulario difieren de los originales. */
  protected readonly hayCambios = computed(() => {
    const original = this.original();
    if (!original) return false;
    const actual = this.model();
    if (actual.nombre.trim() !== original.nombre) return true;
    if (actual.descripcion.trim() !== original.descripcion) return true;
    if (actual.duracion !== original.duracion) return true;
    if (actual.precio !== original.precio) return true;
    if (this.fotoArchivo() !== null) return true;
    return false;
  });

  protected readonly puedeGuardar = computed(() => {
    if (this.guardando() || this.subiendoFoto()) return false;
    return !this.formulario().invalid();
  });

  private readonly botonSeguirEditando = viewChild<ElementRef<HTMLButtonElement>>('botonSeguirEditando');

  /**
   * El modal de detalle, que queda por debajo, marca este componente como
   * inerte para que no se pueda interactuar con lo que está atrás. Cuando el
   * formulario se abre hay que quitarlo: si no, no podría recibir foco ni
   * eventos.
   */
  @HostBinding('attr.inert')
  get inactivo(): string | null {
    return this.abierto() ? null : '';
  }

  constructor() {
    // Precarga: al abrir el formulario se cargan los datos del servicio, nunca
    // campos vacíos.
    effect(() => {
      const abierto = this.abierto();
      const servicio = this.servicio();
      if (!abierto || !servicio) return;
      this.precargar(servicio);
    });

    // Al mostrar la confirmación de descarte el foco pasa a "Seguir editando".
    effect(() => {
      if (!this.confirmacionAbierta()) return;
      afterNextRender(
        () => {
          try {
            this.botonSeguirEditando()?.nativeElement.focus();
          } catch {
            // El botón puede no estar montado todavía.
          }
        },
        { injector: this.injector },
      );
    });
  }

  /** Carga en el formulario los datos que ya pertenecen al servicio. */
  private precargar(servicio: ServicioDTO): void {
    const valores: EditarServicioModel = {
      nombre: servicio.nombre?.trim() ?? '',
      descripcion: servicio.descripcion?.trim() ?? '',
      duracion:
        typeof servicio.duracion === 'number' && Number.isFinite(servicio.duracion)
          ? servicio.duracion
          : null,
      precio: this.precioDelServicio(servicio.precio),
    };

    this.model.set(valores);
    this.original.set(valores);
    this.fotoActual.set(servicio.fotoPerfil?.trim() || null);
    this.fotoArchivo.set(null);
    this.fotoPreview.set(null);
    this.erroresBackend.set({});
    this.errorGeneral.set(null);
    this.intentadoEnviar.set(false);
    this.confirmacionAbierta.set(false);
    try {
      // Limpia el estado "tocado" de los campos sin borrar los valores.
      this.formulario().reset();
    } catch {
      // ignore
    }
  }

  /**
   * Mensaje de error de un campo: primero el que devuelve el backend y, si no
   * hay, el de la validación del cliente. El error recién se muestra cuando el
   * campo fue tocado o cuando se intentó enviar el formulario.
   */
  private mensajeDeCampo(
    estado: { touched(): boolean; invalid(): boolean; errors(): readonly { message?: string }[] },
    mensajeBackend: string | undefined,
    porDefecto: string,
  ): string | null {
    if (mensajeBackend) return mensajeBackend;
    if (!estado.invalid()) return null;
    if (!estado.touched() && !this.intentadoEnviar()) return null;
    return estado.errors()[0]?.message ?? porDefecto;
  }

  /** Precio del servicio como número, tal como lo espera el DTO (BigDecimal). */
  private precioDelServicio(precio: ServicioDTO['precio']): number | null {
    if (precio === null || precio === undefined) return null;
    const valor = typeof precio === 'string' ? Number(precio) : precio;
    if (!Number.isFinite(valor)) return null;
    return valor;
  }

  /** Duración en minutos como número entero, tal como lo espera el DTO. */
  private duracionEnMinutos(): number {
    const duracion = this.model().duracion;
    return typeof duracion === 'number' && Number.isFinite(duracion) ? Math.round(duracion) : 0;
  }

  /** Precio como número, tal como lo espera el DTO (BigDecimal). */
  private precioNumerico(): number {
    const precio = this.model().precio;
    return typeof precio === 'number' && Number.isFinite(precio) ? precio : 0;
  }

  protected onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (!file) return;
    this.fotoArchivo.set(file);
    this.fotoPreview.set(null);
    const reader = new FileReader();
    reader.onload = () => this.fotoPreview.set(String(reader.result ?? ''));
    reader.readAsDataURL(file);
  }

  private validarImagen(archivo: File): string | null {
    if (archivo.size > 5 * 1024 * 1024) {
      return 'La imagen no puede superar los 5 MB.';
    }
    if (!/^image\/(jpeg|png|webp|gif)$/i.test(archivo.type)) {
      return 'El archivo debe ser una imagen JPG, PNG, WEBP o GIF.';
    }
    return null;
  }

  /**
   * Mueve el foco al primer campo inválido para que el usuario sepa dónde
   * corregir. No cambia la ruta ni el estado del formulario.
   */
  private enfocarPrimerCampoInvalido(): void {
    const campos = [
      this.formulario.nombre,
      this.formulario.descripcion,
      this.formulario.duracion,
      this.formulario.precio,
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
  }

  /**
   * Cierra el formulario. Si hubo cambios se pide confirmación antes de
   * descartarlos; si no, se cierra directamente.
   */
  protected solicitarCierre(): void {
    if (this.guardando()) return;

    if (this.confirmacionAbierta()) {
      this.confirmacionAbierta.set(false);
      return;
    }

    if (this.hayCambios()) {
      this.confirmacionAbierta.set(true);
      return;
    }

    this.cerrar.emit();
  }

  /** Vuelve al formulario sin descartar los cambios. */
  protected seguirEditando(): void {
    this.confirmacionAbierta.set(false);
  }

  /** Descarta los cambios y cierra el formulario. */
  protected descartarCambios(): void {
    this.confirmacionAbierta.set(false);
    this.cerrar.emit();
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    // Evita envíos duplicados mientras hay una actualización en curso.
    if (this.guardando()) return;

    this.intentadoEnviar.set(true);
    this.formulario().markAsTouched();
    this.erroresBackend.set({});
    this.errorGeneral.set(null);

    const archivo = this.fotoArchivo();
    if (archivo) {
      const mensaje = this.validarImagen(archivo);
      if (mensaje) {
        this.errorGeneral.set(mensaje);
        return;
      }
    }

    if (this.formulario().invalid()) {
      this.enfocarPrimerCampoInvalido();
      return;
    }

    const servicio = this.servicio();
    if (!servicio) return;

    this.guardando.set(true);
    this.subiendoFoto.set(false);

    this.subirFoto(archivo)
      .pipe(
        switchMap((subida) => {
          this.subiendoFoto.set(false);
          return this.api.actualizar(servicio.id, this.construirPayload(subida));
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.guardando.set(false);
          this.subiendoFoto.set(false);
          this.cerrar.emit();
          this.actualizado.emit();
        },
        error: (err: unknown) => {
          this.guardando.set(false);
          this.subiendoFoto.set(false);
          const { campos, general } = mapearErroresFormulario(err, (status) =>
            this.mensajeErrorModificacion(status),
          );
          this.erroresBackend.set(campos);
          this.errorGeneral.set(general);
        },
      });
  }

  /** Sube la imagen nueva a Cloudinary. Sin imagen nueva no hay nada que subir. */
  private subirFoto(archivo: File | null): Observable<FotoSubida | null> {
    if (!archivo) return of(null);
    this.subiendoFoto.set(true);
    if (!this.http || !this.backend) return of(null);

    const formData = new FormData();
    formData.append('file', archivo);
    return this.http
      .post<unknown>(`${this.backend.baseUrl}/imagenes/upload?tipo=SERVICIO`, formData, {
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
   * Arma la petición con los campos que el empleador modificó. Los que no
   * cambiaron no se envían: el backend conserva su valor actual.
   */
  private construirPayload(subida: FotoSubida | null): ServicioModificarPayload {
    const original = this.original();
    const actual = this.model();

    const nombre = actual.nombre.trim();
    const descripcion = actual.descripcion.trim();
    const duracion = this.duracionEnMinutos();
    const precio = this.precioNumerico();

    const payload: {
      nombre?: string;
      descripcion?: string;
      duracion?: number;
      precio?: number;
      fotoUrl?: string;
      fotoPublicId?: string | null;
    } = {};

    if (!original || nombre !== original.nombre) payload.nombre = nombre;
    if (!original || descripcion !== original.descripcion) payload.descripcion = descripcion;
    if (!original || actual.duracion !== original.duracion) payload.duracion = duracion;
    if (!original || actual.precio !== original.precio) payload.precio = precio;

    // La foto solo viaja cuando se eligió una imagen nueva; si no, el servicio
    // conserva la que ya tenía.
    if (subida?.url) {
      payload.fotoUrl = subida.url;
      payload.fotoPublicId = subida.publicId;
    }

    return payload;
  }

  /**
   * Mensaje general del error. Cuando el backend explica una regla concreta
   * (4xx) se muestra el suyo; para fallas del servidor o de red se muestra un
   * mensaje propio que no expone detalles internos.
   */
  private mensajeErrorModificacion(status: number): string {
    if (status === 0) {
      return 'No pudimos conectarnos con el servidor. Revisá tu conexión e intentá de nuevo.';
    }
    if (status === 403) {
      return 'No tenés permisos para modificar servicios de esta sucursal.';
    }
    if (status === 404) {
      return 'No encontramos el servicio que querés modificar.';
    }
    if (status === 409) {
      return 'El servicio no se pudo modificar porque tiene datos en conflicto.';
    }
    if (status === 413) {
      return 'La imagen no puede superar los 5 MB.';
    }
    if (status === 429) {
      return 'Demasiados intentos. Esperá unos segundos e intentá de nuevo.';
    }
    if (status >= 500) {
      return 'Tuvimos un problema al modificar el servicio. Probá de nuevo en unos segundos.';
    }
    return 'No pudimos modificar el servicio. Revisá los datos e intentá de nuevo.';
  }
}
