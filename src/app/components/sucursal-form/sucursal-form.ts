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
    minLength(campos.direccion, 10, { message: 'La dirección debe tener al menos 10 caracteres.' });
    maxLength(campos.direccion, 60, { message: 'La dirección no puede superar los 60 caracteres.' });
    pattern(campos.direccion, /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\d\s.,#-]+$/, {
      message: 'La dirección solo puede contener letras y números.',
    });

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
    return true;
  });

  constructor() {
    this.cargarCategorias();

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
    };

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

    if (this.formulario().invalid() || dias.length === 0 || faltaFoto || this.horariosInvalidos()) {
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
  }
}
