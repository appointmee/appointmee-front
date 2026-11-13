import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';

import { SucursalGaleriaImagenDTO, sucursalService } from '../../services/sucursal-service';

@Component({
  selector: 'app-galeria-sucursal',
  imports: [RouterLink],
  templateUrl: './galeria-sucursal.html',
  styleUrl: './galeria-sucursal.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GaleriaSucursal {
  private readonly api = inject(sucursalService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly sucursalId = Number(this.route.snapshot.paramMap.get('sucursalId'));
  protected readonly imagenes = signal<readonly SucursalGaleriaImagenDTO[]>([]);
  protected readonly fotoFondo = signal<string | null>(null);
  protected readonly cargando = signal(true);
  protected readonly guardando = signal(false);
  protected readonly eliminandoId = signal<number | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly mensaje = signal<string | null>(null);
  protected readonly imagenesFallidas = signal<ReadonlySet<number>>(new Set());
  protected readonly maxImagenes = 5;

  constructor() {
    if (!Number.isInteger(this.sucursalId) || this.sucursalId < 1) {
      this.error.set('No encontramos la sucursal solicitada.');
      this.cargando.set(false);
      return;
    }
    this.api.obtenerPorId(this.sucursalId, true).pipe(
      catchError(() => of(null)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((sucursal) => this.fotoFondo.set(sucursal?.fotoPerfil?.trim() || null));
    this.cargar();
  }

  protected onFotoFondoError(): void {
    this.fotoFondo.set(null);
  }

  protected cargar(): void {
    if (this.guardando() || this.eliminandoId() !== null) return;
    this.cargando.set(true);
    this.error.set(null);
    this.api.listarImagenes(this.sucursalId).pipe(
      catchError((error: HttpErrorResponse) => {
        this.error.set(error.status === 0
          ? 'Revisá tu conexión e intentá cargar la galería nuevamente.'
          : 'No pudimos cargar las imágenes de esta sucursal.');
        return of(null);
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((imagenes) => {
      if (imagenes) {
        this.imagenes.set(imagenes);
        this.imagenesFallidas.set(new Set());
      }
      this.cargando.set(false);
    });
  }

  protected subir(event: Event): void {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0];
    input.value = '';
    this.mensaje.set(null);
    this.error.set(null);
    if (!archivo || this.guardando() || this.imagenes().length >= this.maxImagenes) return;
    if (!archivo.type.startsWith('image/')) {
      this.error.set('Elegí un archivo de imagen válido.');
      return;
    }

    this.guardando.set(true);
    this.api.subirImagenGaleria(this.sucursalId, archivo).pipe(
      catchError((error: HttpErrorResponse) => {
        this.error.set(error.status === 0
          ? 'No pudimos conectar para subir la imagen. Revisá tu conexión e intentá de nuevo.'
          : error.status === 409
            ? 'La galería admite hasta 5 imágenes. Eliminá una antes de agregar otra.'
            : 'No pudimos subir la imagen. Intentá nuevamente.');
        return of(null);
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((imagen) => {
      if (imagen) {
        this.imagenes.update((actuales) => [...actuales, imagen]);
        this.mensaje.set('La imagen se agregó a la galería.');
      }
      this.guardando.set(false);
    });
  }

  protected eliminar(imagen: SucursalGaleriaImagenDTO): void {
    if (this.guardando() || this.eliminandoId() !== null) return;
    this.error.set(null);
    this.mensaje.set(null);
    this.eliminandoId.set(imagen.id);
    this.api.eliminarImagenGaleria(this.sucursalId, imagen.id).pipe(
      catchError((error: HttpErrorResponse) => {
        this.error.set(error.status === 0
          ? 'No pudimos conectar para eliminar la imagen. Revisá tu conexión e intentá de nuevo.'
          : 'No pudimos eliminar la imagen. Intentá nuevamente.');
        return of(null);
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((resultado) => {
      if (resultado !== null) {
        this.imagenes.update((actuales) => actuales.filter((actual) => actual.id !== imagen.id));
        this.mensaje.set('La imagen se quitó de la galería.');
      }
      this.eliminandoId.set(null);
    });
  }

  protected marcarImagenFallida(id: number): void {
    this.imagenesFallidas.update((fallidas) => new Set([...fallidas, id]));
  }
}
