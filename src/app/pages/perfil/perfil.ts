import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { Observable, Subject, catchError, map, of, startWith, switchMap, tap } from 'rxjs';

import { DsButtonComponent } from '../../shared/ui/button/button.component';
import { humanizarCategoria, inicialesDeTexto } from '../../models/solicitud-empleado';
import { formatearFechaSolicitud } from '../../models/solicitud-empleador';
import { SucursalMiniDTO } from '../../models/sucursal';
import { UsuarioPerfilDTO } from '../../models/usuario';
import { authService } from '../../services/auth-service';
import { sucursalService } from '../../services/sucursal-service';
import { usuarioService } from '../../services/usuario-service';
import { fotoPerfilDe } from '../../shared/foto-perfil';

type ResultadoPerfil =
  | { readonly estado: 'ok'; readonly perfil: UsuarioPerfilDTO }
  | { readonly estado: 'sin-usuario' }
  | { readonly estado: 'sin-conexion' }
  | { readonly estado: 'error'; readonly mensaje: string };

type ResultadoSucursales =
  | { readonly estado: 'ok'; readonly sucursales: readonly SucursalMiniDTO[] }
  | { readonly estado: 'sin-conexion' }
  | { readonly estado: 'error'; readonly mensaje: string };

const PLACEHOLDER_SUCURSAL = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320"><rect width="320" height="320" fill="#10151d"/><g fill="none" stroke="#98a2b3" stroke-width="3" opacity="0.65"><path d="M74 226h172M87 226V132l73-48 73 48v94M123 226v-57h74v57"/><path d="M146 169h28M160 155v28"/></g><text x="160" y="278" text-anchor="middle" fill="#98a2b3" font-size="17" font-family="sans-serif">Sin imagen disponible</text></svg>',
)}`;

@Component({
  selector: 'app-perfil',
  imports: [DsButtonComponent, RouterLink],
  templateUrl: './perfil.html',
  styleUrl: './perfil.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Perfil {
  private readonly usuariosApi = inject(usuarioService);
  private readonly sucursalesApi = inject(sucursalService);
  protected readonly auth = inject(authService);
  private readonly title = inject(Title);
  private readonly destroyRef = inject(DestroyRef);

  private readonly recargarPerfil$ = new Subject<{ readonly inicial: boolean }>();
  private readonly recargarSucursales$ = new Subject<void>();

  protected readonly perfil = signal<UsuarioPerfilDTO | null>(null);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly sinConexion = signal(false);
  protected readonly reintentando = signal(false);

  protected readonly sucursalesPropias = signal<readonly SucursalMiniDTO[]>([]);
  protected readonly cargandoSucursales = signal(false);
  protected readonly errorSucursales = signal<string | null>(null);
  protected readonly sinConexionSucursales = signal(false);
  protected readonly reintentandoSucursales = signal(false);

  protected readonly fotoPerfilFallida = signal(false);
  protected readonly imagenesFallidas = signal<ReadonlySet<number>>(new Set());

  protected readonly nombreCompleto = computed(() => {
    const actual = this.perfil();
    const nombre = [actual?.nombre?.trim(), actual?.apellido?.trim()].filter(Boolean).join(' ');
    return nombre || 'Mi perfil';
  });

  protected readonly email = computed(
    () => this.perfil()?.email?.trim() || this.auth.perfil()?.email?.trim() || '',
  );

  protected readonly iniciales = computed(() => inicialesDeTexto(this.nombreCompleto()));

  protected readonly fotoPerfil = computed(() => {
    const foto = fotoPerfilDe(this.perfil());
    return foto && !this.fotoPerfilFallida() ? foto : null;
  });

  protected readonly fechaCreacion = computed(() => {
    const fecha = this.perfil()?.fechaCreacion ?? '';
    return fecha.trim() ? formatearFechaSolicitud(fecha) : 'Fecha no disponible';
  });

  protected readonly esEmpleador = computed(() =>
    (this.perfil()?.roles ?? []).includes('EMPLEADOR'),
  );

  protected readonly sucursalesEmpleador = computed(() =>
    this.deduplicar(this.sucursalesPropias()),
  );

  protected readonly sucursalesEmpleado = computed(() => {
    const idsComoEmpleador = new Set(this.sucursalesEmpleador().map((sucursal) => sucursal.id));
    return this.deduplicar(this.perfil()?.sucursalesEmpleado ?? []).filter(
      (sucursal) => !idsComoEmpleador.has(sucursal.id),
    );
  });

  protected readonly humanizarCategoria = humanizarCategoria;

  constructor() {
    this.recargarPerfil$
      .pipe(
        startWith({ inicial: true }),
        switchMap(({ inicial }) => {
          if (inicial) {
            this.prepararPerfil();
          }
          return this.cargarPerfil();
        }),
        tap((resultado) => this.aplicarPerfil(resultado)),
        switchMap((resultado) => {
          if (resultado.estado !== 'ok' || !this.esEmpleador()) {
            this.cargandoSucursales.set(false);
            return of(null);
          }

          this.cargandoSucursales.set(true);
          return this.cargarSucursalesEmpleador();
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((resultado) => {
        if (resultado) {
          this.aplicarSucursales(resultado);
        }
      });

    this.recargarSucursales$
      .pipe(
        switchMap(() => this.cargarSucursalesEmpleador()),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((resultado) => this.aplicarSucursales(resultado));
  }

  protected reintentarPerfil(): void {
    if (this.reintentando() || this.cargando()) {
      return;
    }

    this.reintentando.set(true);
    this.recargarPerfil$.next({ inicial: false });
  }

  protected reintentarSucursales(): void {
    if (this.reintentandoSucursales() || this.cargandoSucursales()) {
      return;
    }

    this.reintentandoSucursales.set(true);
    this.recargarSucursales$.next();
  }

  protected onFotoPerfilError(): void {
    this.fotoPerfilFallida.set(true);
  }

  protected onImagenSucursalError(sucursal: SucursalMiniDTO): void {
    this.imagenesFallidas.update((fallidas) => new Set([...fallidas, sucursal.id]));
  }

  protected imagenSucursal(sucursal: SucursalMiniDTO): string {
    const foto = fotoPerfilDe(sucursal);
    return foto && !this.imagenesFallidas().has(sucursal.id) ? foto : PLACEHOLDER_SUCURSAL;
  }

  protected altImagenSucursal(sucursal: SucursalMiniDTO): string {
    const foto = fotoPerfilDe(sucursal);
    return foto && !this.imagenesFallidas().has(sucursal.id)
      ? `Foto de ${sucursal.nombre}`
      : `Sin imagen disponible para ${sucursal.nombre}`;
  }

  protected puntuacion(sucursal: SucursalMiniDTO): number {
    const valor = sucursal.puntuacion;
    return typeof valor === 'number' && Number.isFinite(valor)
      ? Math.round(Math.max(0, Math.min(5, valor)) * 10) / 10
      : 0;
  }

  protected cantidadResenias(sucursal: SucursalMiniDTO): number {
    const valor = sucursal.cantidadPuntuaciones;
    return typeof valor === 'number' && Number.isFinite(valor) && valor > 0 ? valor : 0;
  }

  protected tienePuntuaciones(sucursal: SucursalMiniDTO): boolean {
    return this.cantidadResenias(sucursal) > 0 && sucursal.puntuacion !== null;
  }

  protected abejas(sucursal: SucursalMiniDTO): readonly boolean[] {
    const puntuacion = this.puntuacion(sucursal);
    return [1, 2, 3, 4, 5].map((posicion) => posicion <= puntuacion);
  }

  protected textoPuntuacion(sucursal: SucursalMiniDTO): string {
    return this.tienePuntuaciones(sucursal)
      ? `Puntuación ${this.puntuacion(sucursal).toFixed(1)} de 5, ${this.cantidadResenias(sucursal)} reseñas`
      : `La sucursal ${sucursal.nombre} todavía no tiene reseñas`;
  }

  private prepararPerfil(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.sinConexion.set(false);
    this.reintentando.set(false);
    this.perfil.set(null);
    this.fotoPerfilFallida.set(false);
    this.imagenesFallidas.set(new Set());
    this.sucursalesPropias.set([]);
    this.cargandoSucursales.set(false);
    this.errorSucursales.set(null);
    this.sinConexionSucursales.set(false);
    this.reintentandoSucursales.set(false);
  }

  private cargarPerfil(): Observable<ResultadoPerfil> {
    const id = this.auth.perfil()?.id;

    if (!Number.isInteger(id) || (id ?? 0) <= 0) {
      return of<ResultadoPerfil>({ estado: 'sin-usuario' });
    }

    return this.usuariosApi.obtenerPerfil(id as number).pipe(
      map((perfil): ResultadoPerfil => ({ estado: 'ok', perfil })),
      catchError((error: HttpErrorResponse) => of(this.mapearErrorPerfil(error))),
    );
  }

  private cargarSucursalesEmpleador(): Observable<ResultadoSucursales> {
    if (!this.esEmpleador()) {
      return of<ResultadoSucursales>({ estado: 'ok', sucursales: [] });
    }

    return this.sucursalesApi.listarPropias().pipe(
      map((sucursales): ResultadoSucursales => ({ estado: 'ok', sucursales })),
      catchError((error: HttpErrorResponse) => of(this.mapearErrorSucursales(error))),
    );
  }

  private mapearErrorPerfil(error: HttpErrorResponse): ResultadoPerfil {
    if (error.status === 0) {
      return { estado: 'sin-conexion' };
    }

    if (error.status === 401) {
      return {
        estado: 'error',
        mensaje: 'Tu sesión expiró. Iniciá sesión nuevamente para ver tu perfil.',
      };
    }

    return {
      estado: 'error',
      mensaje: 'No pudimos cargar la información de tu perfil. Intentá de nuevo en unos segundos.',
    };
  }

  private mapearErrorSucursales(error: HttpErrorResponse): ResultadoSucursales {
    if (error.status === 0) {
      return { estado: 'sin-conexion' };
    }

    return {
      estado: 'error',
      mensaje: 'No pudimos cargar tus sucursales como empleador. Intentá de nuevo en unos segundos.',
    };
  }

  private aplicarPerfil(resultado: ResultadoPerfil): void {
    this.cargando.set(false);
    this.reintentando.set(false);

    switch (resultado.estado) {
      case 'ok':
        this.perfil.set(resultado.perfil);
        this.error.set(null);
        this.sinConexion.set(false);
        this.title.setTitle('AppointMee | Mi Perfil');
        break;
      case 'sin-usuario':
        this.perfil.set(null);
        this.error.set('No pudimos identificar tu cuenta. Volvé a iniciar sesión e intentá de nuevo.');
        this.sinConexion.set(false);
        break;
      case 'sin-conexion':
        this.perfil.set(null);
        this.error.set('No pudimos conectarnos. Revisá tu conexión a internet e intentá de nuevo.');
        this.sinConexion.set(true);
        break;
      case 'error':
        this.perfil.set(null);
        this.error.set(resultado.mensaje);
        this.sinConexion.set(false);
        break;
    }
  }

  private aplicarSucursales(resultado: ResultadoSucursales): void {
    this.cargandoSucursales.set(false);
    this.reintentandoSucursales.set(false);

    switch (resultado.estado) {
      case 'ok':
        this.sucursalesPropias.set(resultado.sucursales);
        this.errorSucursales.set(null);
        this.sinConexionSucursales.set(false);
        break;
      case 'sin-conexion':
        this.sucursalesPropias.set([]);
        this.errorSucursales.set(
          'No pudimos conectarnos para cargar tus sucursales como empleador.',
        );
        this.sinConexionSucursales.set(true);
        break;
      case 'error':
        this.sucursalesPropias.set([]);
        this.errorSucursales.set(resultado.mensaje);
        this.sinConexionSucursales.set(false);
        break;
    }
  }

  private deduplicar(sucursales: readonly SucursalMiniDTO[]): readonly SucursalMiniDTO[] {
    const unicas = new Map<number, SucursalMiniDTO>();
    for (const sucursal of sucursales) {
      if (!unicas.has(sucursal.id)) {
        unicas.set(sucursal.id, sucursal);
      }
    }
    return [...unicas.values()];
  }
}
