import { DsButtonComponent } from '../../shared/ui/button/button.component';
import { DsInputComponent } from '../../shared/ui/input/input.component';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { FormField, form, maxLength, minLength, pattern, required } from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import { from, Observable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

import { SucursalPayload } from '../../models/sucursal';
import { backendService } from '../../services/backend-service';
import { sucursalService } from '../../services/sucursal-service';

interface CrearSucursalModel {
  nombre: string;
  direccion: string;
  telefono: string;
  descripcion: string;
  categoria: string;
  horaApertura: string;
  horaCierre: string;
  diasApertura: string[];
}

const DIAS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'] as const;
const ABREVIATURAS: Record<string, string> = {
  MONDAY: 'LU',
  TUESDAY: 'MA',
  WEDNESDAY: 'MI',
  THURSDAY: 'JU',
  FRIDAY: 'VI',
  SATURDAY: 'SA',
  SUNDAY: 'DO',
};

@Component({
  selector: 'app-crear-sucursal',
  imports: [DsButtonComponent, DsInputComponent, FormField, RouterLink],
  templateUrl: './crear-sucursal.html',
  styleUrl: './crear-sucursal.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CrearSucursalPage implements OnInit {
  private readonly api = inject(sucursalService);
  private readonly http = inject(HttpClient, { optional: true });
  private readonly backend = inject(backendService, { optional: true });
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  cargando = signal(false);
  subiendoFoto = signal(false);
  error = signal<string | null>(null);
  exito = signal<string | null>(null);
  intentadoEnviar = signal(false);

  categorias = signal<{ id: number; nombre: string }[]>([]);
  diasSeleccionados = signal<string[]>([]);

  fotoArchivo = signal<File | null>(null);
  fotoPreview = signal<string | null>(null);
  fotoUrl = signal<string | null>(null);
  fotoPublicId = signal<string | null>(null);

  model = signal<CrearSucursalModel>({
    nombre: '',
    direccion: '',
    telefono: '',
    descripcion: '',
    categoria: '',
    horaApertura: '',
    horaCierre: '',
    diasApertura: [],
  });

  formulario = form(this.model, (campos) => {
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
    minLength(campos.telefono, 0, { message: '' });

    required(campos.descripcion, { message: 'Ingresá la descripción.' });
    minLength(campos.descripcion, 10, { message: 'La descripción debe tener al menos 10 caracteres.' });
    maxLength(campos.descripcion, 1500, { message: 'La descripción no puede superar los 1500 caracteres.' });

    required(campos.categoria, { message: 'Seleccioná una categoría.' });

    required(campos.horaApertura, { message: 'Ingresá la hora de apertura.' });
    required(campos.horaCierre, { message: 'Ingresá la hora de cierre.' });
  });

  readonly dias = DIAS;
  readonly abreviaturas = ABREVIATURAS;

  readonly puedeEnviar = computed(() => {
    if (this.cargando() || this.subiendoFoto()) return false;
    const dias = this.model().diasApertura ?? [];
    if (dias.length === 0) return false;
    if (!this.tieneFoto()) return false;
    if (this.formulario().invalid()) return false;
    const apertura = this.model().horaApertura;
    const cierre = this.model().horaCierre;
    if (apertura && cierre && !(cierre > apertura)) return false;
    return true;
  });

  ngOnInit(): void {
    const api = this.api as any;
    if (typeof api?.categoriasConId === 'function') {
      api
        .categoriasConId()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (cats: unknown) => {
            if (Array.isArray(cats)) {
              this.categorias.set(
                cats.map((c: any) => ({ id: Number(c?.id), nombre: String(c?.categoria ?? c?.nombre ?? c) })),
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
              Array.isArray(cats)
                ? cats.map((c, i) => ({ id: i + 1, nombre: String(c) }))
                : [],
            );
          },
          error: () => this.categorias.set([]),
        });
    }
  }

  alternarDia(dia: string): void {
    const actuales = this.model().diasApertura ?? [];
    const nuevos = actuales.includes(dia)
      ? actuales.filter((d) => d !== dia)
      : [...actuales, dia];
    this.model.update((m) => ({ ...m, diasApertura: nuevos }));
    this.diasSeleccionados.set(nuevos);
  }

  diaSeleccionado(dia: string): boolean {
    return (this.model().diasApertura ?? []).includes(dia);
  }

  tieneFoto(): boolean {
    return this.fotoUrl() !== null || this.fotoArchivo() !== null;
  }

  onFileChange(event: Event): void {
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

  categoriaIdDe(nombre: string): number {
    const cat = this.categorias().find((c) => c.nombre === nombre);
    return cat ? cat.id : 1;
  }

  onSubmit(event: Event): void {
    event.preventDefault();
    if (this.cargando()) return;
    this.intentadoEnviar.set(true);
    this.formulario().markAsTouched();

    const dias = this.model().diasApertura ?? [];
    const apertura = this.model().horaApertura;
    const cierre = this.model().horaCierre;
    const horariosInvalidos = !!(apertura && cierre && !(cierre > apertura));

    if (this.formulario().invalid() || dias.length === 0 || !this.tieneFoto() || horariosInvalidos) {
      try {
        this.formulario.nombre().focusBoundControl();
      } catch {
        // ignore
      }
      return;
    }

    this.cargando.set(true);
    this.error.set(null);
    this.exito.set(null);

    const subirSiHaceFalta = (): Observable<{ url: string; publicId: string | null }> => {
      const urlExistente = this.fotoUrl();
      if (urlExistente) {
        return of({ url: urlExistente, publicId: this.fotoPublicId() });
      }
      const archivo = this.fotoArchivo();
      if (!archivo) {
        return of({ url: '', publicId: null });
      }
      this.subiendoFoto.set(true);
      return this.subirFoto(archivo).pipe(
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
          const datos: SucursalPayload & { categoriaId: number; fotoUrl: string; fotoPublicId: string | null } = {
            nombre: this.model().nombre.trim(),
            direccion: this.model().direccion.trim() || null,
            telefono: this.model().telefono.trim() || null,
            descripcion: this.model().descripcion.trim() || null,
            horaApertura: this.model().horaApertura.trim() || null,
            horaCierre: this.model().horaCierre.trim() || null,
            diasApertura: dias,
            fotoUrl: fotoUrl,
            fotoPublicId: fotoPublicId,
            categoriaId: this.categoriaIdDe(this.model().categoria),
          } as any;

          return this.api.crear(datos as any);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.subiendoFoto.set(false);
          this.cargando.set(false);
          this.exito.set('Se ha creado la sucursal con exito');
          setTimeout(() => {
            void this.router.navigateByUrl('/mis-sucursales');
          }, 2000);
        },
        error: (err: any) => {
          this.subiendoFoto.set(false);
          this.cargando.set(false);
          const mensaje =
            (typeof err?.error === 'string' && err.error) ||
            err?.error?.message ||
            err?.message ||
            'No pudimos crear la sucursal. Intentá de nuevo.';
          this.error.set(mensaje);
        },
      });
  }

  private subirFoto(archivo: File): Observable<any> {
    const api = this.api as any;
    const candidatos = ['subirImagen', 'subirFoto', 'subirImagenCloudinary', 'uploadImage', 'upload'];
    for (const nombre of candidatos) {
      if (typeof api?.[nombre] === 'function') {
        try {
          const resultado = api[nombre](archivo, 'SUCURSAL');
          if (resultado && typeof resultado.subscribe === 'function') {
            return resultado;
          }
          if (resultado && typeof resultado.then === 'function') {
            return from(resultado);
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
    const base = this.backend.baseUrl;
    return this.http.post<any>(`${base}/imagenes/upload?tipo=SUCURSAL`, formData);
  }
}
