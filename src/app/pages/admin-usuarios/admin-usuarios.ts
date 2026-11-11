import { DsButtonComponent } from '../../shared/ui/button/button.component';
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
import { RouterLink } from '@angular/router';
import { Subject, catchError, map, of, startWith, switchMap } from 'rxjs';

import {
  FiltrosUsuariosAdmin,
  UsuarioMiniAdminDTO,
  UsuarioPerfilAdminDTO,
} from '../../models/usuario';
import { usuarioService } from '../../services/usuario-service';

type ResultadoLista =
  | { readonly ok: true; readonly usuarios: readonly UsuarioMiniAdminDTO[] }
  | { readonly ok: false; readonly error: HttpErrorResponse };

function mensajeError(error: HttpErrorResponse, contexto: 'lista' | 'detalle' | 'eliminar'): string {
  if (error.status === 0) {
    return 'No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.';
  }
  if (error.status === 403) {
    return 'No tenés permisos para realizar esta acción.';
  }
  if (error.status === 404) {
    return contexto === 'detalle'
      ? 'No encontramos el usuario seleccionado.'
      : 'No se encontró el recurso solicitado.';
  }
  if (contexto === 'eliminar') {
    return typeof error.error === 'string' && error.error.trim()
      ? error.error
      : 'No pudimos eliminar el usuario. Intentá de nuevo.';
  }
  return 'Ocurrió un error inesperado. Intentá de nuevo.';
}

@Component({
  selector: 'app-admin-usuarios',
  imports: [DsButtonComponent, RouterLink],
  templateUrl: './admin-usuarios.html',
  styleUrl: './admin-usuarios.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminUsuarios {
  private readonly api = inject(usuarioService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly recargar = new Subject<FiltrosUsuariosAdmin | null>();
  private revision = 0;
  private filtrosAplicados: FiltrosUsuariosAdmin | null = null;

  protected readonly filtroNombre = signal('');
  protected readonly filtroApellido = signal('');
  protected readonly filtroActivo = signal<'todos' | 'activos' | 'inactivos'>('todos');

  protected readonly usuarios = signal<readonly UsuarioMiniAdminDTO[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly reintentando = signal(false);

  protected readonly expandidos = signal<ReadonlySet<number>>(new Set());
  protected readonly detalles = signal<ReadonlyMap<number, UsuarioPerfilAdminDTO>>(new Map());
  protected readonly cargandoDetalle = signal<ReadonlySet<number>>(new Set());
  protected readonly erroresDetalle = signal<ReadonlyMap<number, string>>(new Map());

  protected readonly eliminando = signal<ReadonlySet<number>>(new Set());
  protected readonly erroresEliminar = signal<ReadonlyMap<number, string>>(new Map());
  protected readonly confirmarEliminar = signal<number | null>(null);
  protected readonly exito = signal<string | null>(null);

  protected readonly total = computed(() => this.usuarios().length);

  constructor() {
    this.recargar
      .pipe(
        startWith(null as FiltrosUsuariosAdmin | null),
        switchMap((filtros) => {
          this.cargando.set(this.usuarios().length === 0);
          const req = filtros ? this.api.filtrarUsuariosAdmin(filtros) : this.api.listarUsuariosAdmin();
          return req.pipe(
            map((usuarios): ResultadoLista => ({ ok: true, usuarios })),
            catchError((error: HttpErrorResponse) => of<ResultadoLista>({ ok: false, error })),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((resultado) => this.aplicarLista(resultado));
  }

  protected aplicarFiltros(): void {
    this.exito.set(null);
    const nombre = this.filtroNombre().trim();
    const apellido = this.filtroApellido().trim();
    const estado = this.filtroActivo();
    const filtros: FiltrosUsuariosAdmin = {
      ...(nombre ? { nombre } : {}),
      ...(apellido ? { apellido } : {}),
      ...(estado === 'todos' ? {} : { activo: estado === 'activos' }),
    };
    const hayFiltros = Object.keys(filtros).length > 0;
    this.filtrosAplicados = hayFiltros ? filtros : null;
    this.recargar.next(this.filtrosAplicados);
  }

  protected limpiarFiltros(): void {
    this.filtroNombre.set('');
    this.filtroApellido.set('');
    this.filtroActivo.set('todos');
    this.exito.set(null);
    this.filtrosAplicados = null;
    this.recargar.next(null);
  }

  protected reintentar(): void {
    if (this.reintentando()) return;
    this.reintentando.set(true);
    this.exito.set(null);
    this.recargar.next(this.filtrosAplicados);
  }

  protected estaExpandido(id: number): boolean {
    return this.expandidos().has(id);
  }

  protected detalleDe(id: number): UsuarioPerfilAdminDTO | null {
    return this.detalles().get(id) ?? null;
  }

  protected cargandoDetalleDe(id: number): boolean {
    return this.cargandoDetalle().has(id);
  }

  protected errorDetalleDe(id: number): string | null {
    return this.erroresDetalle().get(id) ?? null;
  }

  protected eliminandoDe(id: number): boolean {
    return this.eliminando().has(id);
  }

  protected errorEliminarDe(id: number): string | null {
    return this.erroresEliminar().get(id) ?? null;
  }

  protected alternar(id: number): void {
    const abiertos = new Set(this.expandidos());
    if (abiertos.has(id)) {
      abiertos.delete(id);
    } else {
      abiertos.add(id);
      if (!this.detalles().has(id)) this.cargarDetalle(id);
    }
    this.expandidos.set(abiertos);
  }

  protected reintentarDetalle(id: number): void {
    if (this.cargandoDetalle().has(id)) return;
    this.cargarDetalle(id);
  }

  protected pedirConfirmacionEliminar(id: number): void {
    this.erroresEliminar.update((m) => {
      const n = new Map(m);
      n.delete(id);
      return n;
    });
    this.confirmarEliminar.set(id);
  }

  protected cancelarEliminar(): void {
    this.confirmarEliminar.set(null);
  }

  protected confirmarEliminarUsuario(id: number): void {
    if (this.eliminando().has(id)) return;
    this.exito.set(null);
    this.eliminando.update((s) => new Set(s).add(id));
    this.erroresEliminar.update((m) => {
      const n = new Map(m);
      n.delete(id);
      return n;
    });

    this.api
      .eliminarUsuarioAdmin(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.usuarios.update((lista) => lista.filter((u) => u.id !== id));
          this.expandidos.update((s) => {
            const n = new Set(s);
            n.delete(id);
            return n;
          });
          this.detalles.update((m) => {
            const n = new Map(m);
            n.delete(id);
            return n;
          });
          this.eliminando.update((s) => {
            const n = new Set(s);
            n.delete(id);
            return n;
          });
          this.confirmarEliminar.set(null);
          this.exito.set('El usuario fue eliminado correctamente.');
        },
        error: (error: HttpErrorResponse) => {
          this.eliminando.update((s) => {
            const n = new Set(s);
            n.delete(id);
            return n;
          });
          this.erroresEliminar.update((m) => new Map(m).set(id, mensajeError(error, 'eliminar')));
        },
      });
  }

  private aplicarLista(resultado: ResultadoLista): void {
    this.revision++;
    if (!resultado.ok) {
      this.error.set(mensajeError(resultado.error, 'lista'));
      this.cargando.set(false);
      this.reintentando.set(false);
      if (this.usuarios().length === 0) {
        this.detalles.set(new Map());
        this.expandidos.set(new Set());
      }
      return;
    }
    this.error.set(null);
    this.usuarios.set(resultado.usuarios);
    this.detalles.set(new Map());
    this.erroresDetalle.set(new Map());
    this.erroresEliminar.set(new Map());
    this.cargandoDetalle.set(new Set());
    this.expandidos.set(new Set());
    this.confirmarEliminar.set(null);
    this.cargando.set(false);
    this.reintentando.set(false);
  }

  private cargarDetalle(id: number): void {
    if (this.cargandoDetalle().has(id)) return;
    const rev = this.revision;
    this.cargandoDetalle.update((s) => new Set(s).add(id));
    this.erroresDetalle.update((m) => {
      const n = new Map(m);
      n.delete(id);
      return n;
    });

    this.api
      .verDetalleUsuarioAdmin(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (detalle) => {
          if (rev !== this.revision) return;
          this.detalles.update((m) => new Map(m).set(id, detalle));
          this.cargandoDetalle.update((s) => {
            const n = new Set(s);
            n.delete(id);
            return n;
          });
        },
        error: (error: HttpErrorResponse) => {
          if (rev !== this.revision) return;
          this.cargandoDetalle.update((s) => {
            const n = new Set(s);
            n.delete(id);
            return n;
          });
          this.erroresDetalle.update((m) => new Map(m).set(id, mensajeError(error, 'detalle')));
        },
      });
  }
}
