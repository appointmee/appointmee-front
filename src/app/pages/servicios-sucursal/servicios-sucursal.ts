import { DsButtonComponent } from '../../shared/ui/button/button.component';
import { DsInputComponent } from '../../shared/ui/input/input.component';
import { DsModalComponent } from '../../shared/ui/misc/misc.component';
import { HttpClient, HttpErrorResponse, HttpContext } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterEveryRender,
  computed,
  inject,
  signal,
  viewChildren,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject, from, of } from 'rxjs';
import { catchError, map, startWith, switchMap } from 'rxjs/operators';

import { FormField, form, maxLength, minLength, min, max, pattern, required, validate } from '@angular/forms/signals';

import { ServicioDTO, ServicioPayload } from '../../models/servicio';
import { SIN_MANEJO_GLOBAL_DE_ERRORES } from '../../http/error-handling-context';
import { backendService } from '../../services/backend-service';
import { servicioService } from '../../services/servicio-service';
import { sucursalService } from '../../services/sucursal-service';

interface CrearServicioModel {
  nombre: string;
  descripcion: string;
  duracion: number | null;
  precio: number | null;
}

const FORMATO_PRECIO = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
});

const LARGO_DESCRIPCION_ESTIMADO = 160;

const FORMATO_DURACION = (minutos: number | null | undefined): string => {
  if (minutos === null || minutos === undefined || !Number.isFinite(minutos) || minutos <= 0) {
    return 'Duración a confirmar';
  }
  if (minutos < 60) {
    return `${minutos} min`;
  }
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`;
};

@Component({
  selector: 'app-servicios-sucursal',
  imports: [DsButtonComponent, DsInputComponent, DsModalComponent, FormField, RouterLink],
  templateUrl: './servicios-sucursal.html',
  styleUrl: './servicios-sucursal.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServiciosSucursal {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly servicioService = inject(servicioService);
  private readonly http = inject(HttpClient, { optional: true });
  private readonly backend = inject(backendService, { optional: true });
  private readonly sucursalApi = inject(sucursalService, { optional: true });
  private readonly destroyRef = inject(DestroyRef);

  protected readonly sucursalId = Number(this.route.snapshot.paramMap.get('sucursalId') ?? '');
  protected readonly sucursalIdValido = Number.isInteger(this.sucursalId) && this.sucursalId > 0;

  protected readonly servicios = signal<readonly ServicioDTO[]>([]);
  protected readonly cargando = signal(this.sucursalIdValido);
  protected readonly error = signal<string | null>(null);
  protected readonly reintentando = signal(false);
  protected readonly sinConexion = signal(typeof navigator === 'undefined' ? false : !navigator.onLine);

  protected readonly modalAbierto = signal(false);
  protected readonly cargandoCreacion = signal(false);
  protected readonly subiendoFoto = signal(false);
  protected readonly errorCreacion = signal<string | null>(null);
  protected readonly exitoCreacion = signal<string | null>(null);
  protected readonly intentadoEnviar = signal(false);
  protected readonly erroresBackend = signal<Record<string, string>>({});

  protected readonly fotoArchivo = signal<File | null>(null);
  protected readonly fotoPreview = signal<string | null>(null);
  protected readonly fotoUrl = signal<string | null>(null);
  protected readonly fotoPublicId = signal<string | null>(null);
  protected readonly errorFoto = computed(() => {
    const backend = this.erroresBackend()['foto'] ?? this.erroresBackend()['fotoUrl'] ?? null;
    if (backend) return backend;
    const archivo = this.fotoArchivo();
    if (archivo) {
      if (archivo.size > 5 * 1024 * 1024) return 'La imagen no puede superar los 5 MB.';
      if (!/^image\/(jpeg|png|webp|gif)$/i.test(archivo.type)) return 'El archivo debe ser una imagen JPG, PNG, WEBP o GIF.';
    }
    if (this.intentadoEnviar() && !this.tieneFoto()) return 'Seleccioná una imagen.';
    return null;
  });

  protected readonly model = signal<CrearServicioModel>({
    nombre: '',
    descripcion: '',
    duracion: null,
    precio: null,
  });

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

    required(campos.duracion, { message: 'Ingresá la duración.' });
    min(campos.duracion, 30, { message: 'La duración mínima es de 30 minutos.' });
    max(campos.duracion, 360, { message: 'La duración máxima es de 360 minutos (6 horas).' });
    validate(campos.duracion, ({ value }) => {
      if (value === null || value === undefined) return null;
      return Number.isInteger(value)
        ? null
        : { kind: 'integer', message: 'La duración debe ser un número entero.' };
    });

    required(campos.precio, { message: 'Ingresá el precio.' });
    min(campos.precio, 0.01, { message: 'El precio mínimo es 0.01.' });
    max(campos.precio, 999999.99, { message: 'El precio máximo es 999999.99.' });
    validate(campos.precio, ({ value }) => {
      if (value === null || value === undefined) return null;
      return /^\d+(\.\d{1,2})?$/.test(String(value))
        ? null
        : { kind: 'digits', message: 'El precio debe tener a lo sumo 2 decimales.' };
    });
  });

  protected readonly puedeCrear = computed(() => {
    if (this.cargandoCreacion() || this.subiendoFoto()) return false;
    if (this.formulario().invalid()) return false;
    if (this.fotoArchivo() === null) return false;
    if (this.errorFoto() !== null) return false;
    return true;
  });

  protected readonly resumenErrores = computed(() => {
    const lista: { id: string; label: string; message: string }[] = [];
    const touched = this.intentadoEnviar();
    const agregar = (id: string, label: string, invalid: boolean, message: string | null) => {
      if (invalid && (touched || this.formulario.nombre().touched())) {
        // se filtra por touched individual abajo
      }
    };
    void agregar;
    if (this.formulario.nombre().touched() && this.formulario.nombre().invalid()) {
      lista.push({ id: 'servicio-nombre', label: 'Nombre', message: this.formulario.nombre().errors()[0]?.message ?? 'Revisá este campo.' });
    }
    if (this.formulario.descripcion().touched() && this.formulario.descripcion().invalid()) {
      lista.push({ id: 'servicio-descripcion', label: 'Descripción', message: this.formulario.descripcion().errors()[0]?.message ?? 'Revisá este campo.' });
    }
    if (this.formulario.duracion().touched() && this.formulario.duracion().invalid()) {
      lista.push({ id: 'servicio-duracion', label: 'Duración', message: this.formulario.duracion().errors()[0]?.message ?? 'Revisá este campo.' });
    }
    if (this.formulario.precio().touched() && this.formulario.precio().invalid()) {
      lista.push({ id: 'servicio-precio', label: 'Precio', message: this.formulario.precio().errors()[0]?.message ?? 'Revisá este campo.' });
    }
    if (this.intentadoEnviar() && this.fotoArchivo() === null) {
      lista.push({ id: 'servicio-foto', label: 'Foto', message: 'Seleccioná una imagen.' });
    }
    const fotoError = this.errorFoto();
    if (fotoError && this.fotoArchivo() !== null) {
      lista.push({ id: 'servicio-foto', label: 'Foto', message: fotoError });
    }
    // Errores de backend por campo
    for (const [campo, mensaje] of Object.entries(this.erroresBackend())) {
      const id = campo.toLowerCase().includes('nombre')
        ? 'servicio-nombre'
        : campo.toLowerCase().includes('desc')
          ? 'servicio-descripcion'
          : campo.toLowerCase().includes('dur')
            ? 'servicio-duracion'
            : campo.toLowerCase().includes('prec')
              ? 'servicio-precio'
              : campo.toLowerCase().includes('foto')
                ? 'servicio-foto'
                : 'servicio-general';
      if (!lista.some((item) => item.id === id)) {
        lista.push({ id, label: campo, message: mensaje });
      }
    }
    return lista;
  });

  protected readonly errorNombre = computed(() =>
    this.erroresBackend()['nombre'] ??
    (this.formulario.nombre().touched() ? this.formulario.nombre().errors()[0]?.message ?? null : null),
  );
  protected readonly errorDescripcion = computed(() =>
    this.erroresBackend()['descripcion'] ??
    (this.formulario.descripcion().touched() ? this.formulario.descripcion().errors()[0]?.message ?? null : null),
  );
  protected readonly errorDuracion = computed(() =>
    this.erroresBackend()['duracion'] ??
    (this.formulario.duracion().touched() ? this.formulario.duracion().errors()[0]?.message ?? null : null),
  );
  protected readonly errorPrecio = computed(() =>
    this.erroresBackend()['precio'] ??
    (this.formulario.precio().touched() ? this.formulario.precio().errors()[0]?.message ?? null : null),
  );

  private readonly recargar = new Subject<void>();

  private readonly descripcionRefs = viewChildren<ElementRef<HTMLElement>>('descripcionServicio');

  constructor() {
    this.registrarEventosDeConexion();

    if (!this.sucursalIdValido) {
      this.error.set('No pudimos identificar la sucursal solicitada.');
      return;
    }

    afterEveryRender(() => this.medirDescripciones());

    this.recargar
      .pipe(
        startWith(undefined as void),
        switchMap(() => {
          this.cargando.set(this.servicios().length === 0);
          this.error.set(null);
          return this.servicioService.listarPorSucursal(this.sucursalId).pipe(
            map((lista) => ({ ok: true as const, datos: lista ?? [] })),
            catchError((err: HttpErrorResponse) => of({ ok: false as const, error: err })),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((resultado) => {
        this.reintentando.set(false);
        if (!resultado.ok) {
          this.servicios.set([]);
          this.error.set(this.mensajeErrorListado(resultado.error));
          this.cargando.set(false);
          return;
        }
        this.error.set(null);
        this.servicios.set(resultado.datos);
        this.cargando.set(false);
      });
  }

  protected reintentar(): void {
    if (this.reintentando()) return;
    this.reintentando.set(true);
    this.recargar.next();
  }

  protected abrirModal(): void {
    this.limpiarFormulario();
    this.modalAbierto.set(true);
  }

  protected cerrarModal(): void {
    if (this.cargandoCreacion()) return;
    this.modalAbierto.set(false);
  }

  protected onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (!file) return;
    this.fotoArchivo.set(file);
    this.fotoUrl.set(null);
    this.fotoPublicId.set(null);
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

  protected tieneFoto(): boolean {
    return this.fotoUrl() !== null || this.fotoArchivo() !== null;
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    if (this.cargandoCreacion()) return;
    this.intentadoEnviar.set(true);
    this.formulario().markAsTouched();
    this.erroresBackend.set({});
    this.errorCreacion.set(null);

    const archivo = this.fotoArchivo();
    if (archivo) {
      const msg = this.validarImagen(archivo);
      if (msg) return;
    }

    if (this.formulario().invalid() || !this.tieneFoto()) {
      try {
        this.formulario.nombre().focusBoundControl();
      } catch {
        // ignore
      }
      return;
    }

    this.cargandoCreacion.set(true);
    this.subiendoFoto.set(false);

    const subirSiHaceFalta = (): import('rxjs').Observable<{ url: string; publicId: string | null }> => {
      const urlExistente = this.fotoUrl();
      if (urlExistente) {
        return of({ url: urlExistente, publicId: this.fotoPublicId() });
      }
      const file = this.fotoArchivo();
      if (!file) {
        return of({ url: '', publicId: null });
      }
      this.subiendoFoto.set(true);
      if (!this.http || !this.backend) {
        return of({ url: '', publicId: null });
      }
      const formData = new FormData();
      formData.append('file', file);
      return this.http
        .post<any>(`${this.backend.baseUrl}/imagenes/upload?tipo=SERVICIO`, formData, {
          context: new HttpContext().set(SIN_MANEJO_GLOBAL_DE_ERRORES, true),
        })
        .pipe(
          map((res: any) => ({
            url: String(res?.url ?? res?.secure_url ?? ''),
            publicId: res?.publicId ?? res?.public_id ?? null,
          })),
        );
    };

    subirSiHaceFalta()
      .pipe(
        switchMap((resultado) => {
          this.subiendoFoto.set(false);
          const fotoUrl = resultado.url || this.fotoUrl() || '';
          const fotoPublicId = resultado.publicId ?? this.fotoPublicId();
          const datos: ServicioPayload = {
            sucursalId: this.sucursalId,
            nombre: this.model().nombre.trim(),
            descripcion: this.model().descripcion.trim(),
            duracion: this.model().duracion as number,
            precio: this.model().precio as number,
            fotoUrl,
            fotoPublicId,
          };
          return this.servicioService.crear(datos);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.subiendoFoto.set(false);
          this.cargandoCreacion.set(false);
          this.exitoCreacion.set('El servicio se creó correctamente');
          this.modalAbierto.set(false);
          this.recargar.next();
        },
        error: (err: any) => {
          this.subiendoFoto.set(false);
          this.cargandoCreacion.set(false);
          this.mapearError(err);
        },
      });
  }

  private mapearError(err: any): void {
    const backendErrors: Record<string, string> = {};
    let general: string | null = null;

    const body = err?.error;
    if (err?.fields && typeof err.fields === 'object') {
      Object.assign(backendErrors, err.fields);
    }
    if (body && typeof body === 'object') {
      if (body.fields && typeof body.fields === 'object') {
        Object.assign(backendErrors, body.fields);
      }
      const lista = Array.isArray(body?.properties?.errors)
        ? body.properties.errors
        : Array.isArray(body?.errors)
          ? body.errors
          : null;
      if (Array.isArray(lista)) {
        for (const item of lista) {
          const campo = String(item?.field ?? item?.propertyPath ?? item?.name ?? '').trim();
          const mensaje = String(item?.message ?? item?.defaultMessage ?? 'Revisá este campo.').trim();
          if (campo) backendErrors[campo] = mensaje;
        }
      }
      for (const key of Object.keys(body)) {
        if (
          ['message', 'error', 'status', 'timestamp', 'path', 'title', 'detail', 'type', 'instance', 'properties', 'fields'].includes(key)
        ) {
          continue;
        }
        if (typeof body[key] === 'string') {
          backendErrors[key] = body[key];
        }
      }
      if (typeof body.message === 'string' && body.message.trim()) {
        general = body.message;
      } else if (typeof body.detail === 'string' && body.detail.trim()) {
        general = body.detail;
      }
    } else if (typeof body === 'string' && body.trim()) {
      general = body;
    }

    if (Object.keys(backendErrors).length) {
      const normalizados: Record<string, string> = {};
      for (const [campo, mensaje] of Object.entries(backendErrors)) {
        const clave = campo.toLowerCase().includes('nombre')
          ? 'nombre'
          : campo.toLowerCase().includes('desc')
            ? 'descripcion'
            : campo.toLowerCase().includes('dur')
              ? 'duracion'
              : campo.toLowerCase().includes('prec')
                ? 'precio'
                : campo.toLowerCase().includes('foto')
                  ? 'foto'
                  : campo;
        normalizados[clave] = mensaje;
      }
      this.erroresBackend.set(normalizados);
      if (!general) {
        general = 'Revisá los campos marcados e intentá nuevamente.';
      }
    }

    if (!general) {
      general = err?.message || 'No pudimos crear el servicio. Intentá de nuevo.';
    }
    this.errorCreacion.set(general);
  }

  private limpiarFormulario(): void {
    this.model.set({ nombre: '', descripcion: '', duracion: null, precio: null });
    this.fotoArchivo.set(null);
    this.fotoPreview.set(null);
    this.fotoUrl.set(null);
    this.fotoPublicId.set(null);
    this.erroresBackend.set({});
    this.errorCreacion.set(null);
    this.exitoCreacion.set(null);
    this.intentadoEnviar.set(false);
    try {
      this.formulario().reset();
    } catch {
      // ignore
    }
  }

  protected formatDuracion(minutos: number | null | undefined): string {
    return FORMATO_DURACION(minutos);
  }

  protected formatPrecio(precio: ServicioDTO['precio']): string {
    if (typeof precio === 'string' && !precio.trim()) {
      return 'Precio a consultar';
    }
    const valor = typeof precio === 'string' ? Number(precio) : precio;
    if (valor === null || valor === undefined || !Number.isFinite(valor)) {
      return 'Precio a consultar';
    }
    return FORMATO_PRECIO.format(valor);
  }

  protected foto(servicio: ServicioDTO): string {
    return servicio.fotoPerfil?.trim() || this.placeholderImage;
  }

  protected onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.onerror = null;
    img.src = this.placeholderImage;
  }

  protected placeholderImage = `data:image/svg+xml;utf8,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400"><rect width="640" height="400" fill="#0d1117"/><g fill="none" stroke="#98a2b3" stroke-width="3"><rect x="220" y="110" width="200" height="150" rx="16"/><circle cx="280" cy="160" r="20"/><path d="M220 230l55-50 40 34 35-28 70 60"/></g><text x="320" y="310" text-anchor="middle" fill="#98a2b3" font-size="18" font-family="sans-serif">Sin imagen</text></svg>',
  )}`;

  protected trackById(_index: number, servicio: ServicioDTO): number {
    return servicio.id;
  }

  protected descripcionDesbordada(servicio: ServicioDTO): boolean {
    return this.descripcionesDesbordadas().has(servicio.id);
  }

  protected estaDescripcionExpandida(idServicio: number): boolean {
    return this.descripcionesExpandidas().has(idServicio);
  }

  protected alternarDescripcion(idServicio: number): void {
    this.descripcionesExpandidas.update((actuales) => {
      const siguiente = new Set(actuales);
      if (siguiente.has(idServicio)) siguiente.delete(idServicio);
      else siguiente.add(idServicio);
      return siguiente;
    });
  }

  private readonly descripcionesExpandidas = signal<ReadonlySet<number>>(new Set());
  private readonly descripcionesDesbordadas = signal<ReadonlySet<number>>(new Set());

  private medirDescripciones(): void {
    const expandidas = this.descripcionesExpandidas();
    const anteriores = this.descripcionesDesbordadas();
    const siguiente = new Set<number>();
    for (const ref of this.descripcionRefs()) {
      const elemento = ref.nativeElement;
      const id = Number(elemento.dataset['descripcionId']);
      if (!Number.isInteger(id) || id <= 0) continue;
      if (expandidas.has(id) || this.desborda(elemento)) siguiente.add(id);
    }
    if (siguiente.size !== anteriores.size || [...siguiente].some((id) => !anteriores.has(id))) {
      this.descripcionesDesbordadas.set(siguiente);
    }
  }

  private desborda(elemento: HTMLElement): boolean {
    const altoVisible = elemento.clientHeight;
    const altoCompleto = elemento.scrollHeight;
    if (altoVisible > 0 || altoCompleto > 0) {
      return altoCompleto > altoVisible + 1;
    }
    return (elemento.textContent?.trim().length ?? 0) > LARGO_DESCRIPCION_ESTIMADO;
  }

  private onOffline = (): void => {
    this.sinConexion.set(true);
  };
  private onOnline = (): void => {
    this.sinConexion.set(false);
  };
  private registrarEventosDeConexion(): void {
    if (typeof window === 'undefined') return;
    window.addEventListener('offline', this.onOffline);
    window.addEventListener('online', this.onOnline);
    this.destroyRef.onDestroy(() => {
      window.removeEventListener('offline', this.onOffline);
      window.removeEventListener('online', this.onOnline);
    });
  }

  private mensajeErrorListado(error: HttpErrorResponse): string {
    if (error.status === 401) return 'Necesitás iniciar sesión para ver los servicios de esta sucursal.';
    if (error.status === 403) return 'Tu cuenta no tiene permiso para ver los servicios de esta sucursal.';
    if (error.status === 404) return 'No encontramos la sucursal solicitada.';
    if (error.status === 0) return 'No pudimos conectar con el servidor. Revisá tu conexión e intentá de nuevo.';
    return 'No pudimos cargar los servicios de esta sucursal. Intentá de nuevo en unos segundos.';
  }

  protected volverLink = ['/mis-sucursales'];
}