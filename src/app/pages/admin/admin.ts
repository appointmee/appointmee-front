import { DsButtonComponent } from '../../shared/ui/button/button.component';
import { DsInputComponent } from '../../shared/ui/input/input.component';
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
import { Subject, catchError, map, of, startWith, switchMap } from 'rxjs';

import {
  AccionSolicitudEmpleador,
  SolicitudEmpleadorCard,
} from '../../components/solicitud-empleador-card/solicitud-empleador-card';
import { SolicitanteSolicitudEmpleador } from '../../components/solicitud-empleador-detalle/solicitud-empleador-detalle';
import { mensajeErrorSolicitud } from '../../http/solicitud-empleador-errors';
import {
  EstadoSolicitudEmpleador,
  PaginaSolicitudesEmpleadorDTO,
  SolicitudEmpleadorDetalleDTO,
  SolicitudEmpleadorMiniDTO,
  TAMANO_PAGINA_SOLICITUDES,
} from '../../models/solicitud-empleador';
import { solicitudEmpleadorService } from '../../services/solicitud-empleador-service';
import { sucursalService } from '../../services/sucursal-service';
import { PaginaSucursalesDTO, SucursalMiniDTO } from '../../models/sucursal';
import { SucursalDetalleModal } from '../../components/sucursal-detalle-modal/sucursal-detalle-modal';
import { Graficos } from '../graficos/graficos';
import { usuarioService } from '../../services/usuario-service';
import {
  FiltrosUsuariosAdmin,
  PaginaUsuariosAdminDTO,
  UsuarioMiniAdminDTO,
  UsuarioPerfilDTO,
} from '../../models/usuario';
import {
  DsModalComponent,
  DsPaginationComponent,
  DsSelectComponent,
} from '../../shared/ui/misc/misc.component';
import { fotoPerfilDe } from '../../shared/foto-perfil';

type ResultadoLista =
  | { readonly ok: true; readonly pagina: PaginaSolicitudesEmpleadorDTO }
  | { readonly ok: false; readonly error: HttpErrorResponse };

const ESTADOS_SOLICITUD: readonly EstadoSolicitudEmpleador[] = [
  'PENDIENTE',
  'APROBADA',
  'RECHAZADA',
];

const SINGULAR_ESTADO: Readonly<Record<EstadoSolicitudEmpleador, string>> = {
  PENDIENTE: 'pendiente',
  APROBADA: 'aprobada',
  RECHAZADA: 'rechazada',
};

function esEstadoSolicitud(valor: string): valor is EstadoSolicitudEmpleador {
  return ESTADOS_SOLICITUD.some((estado) => estado === valor);
}

type ResultadoSucursales =
  | { readonly ok: true; readonly pagina: PaginaSucursalesDTO }
  | { readonly ok: false };

type ResultadoUsuarios =
  | { readonly ok: true; readonly pagina: PaginaUsuariosAdminDTO }
  | { readonly ok: false };

const ROLES_USUARIO: readonly string[] = [
  'ADMINISTRADOR',
  'EMPLEADOR',
  'EMPLEADO',
  'CLIENTE',
];

/** Evita pedir páginas que el backend ya informó que no existen. */
function paginaValida(pagina: number, totalPaginas: number): number {
  return Math.min(Math.max(0, pagina), Math.max(0, totalPaginas - 1));
}

@Component({
  selector: 'app-admin',
  imports: [DsButtonComponent, DsInputComponent, DsModalComponent, DsPaginationComponent, DsSelectComponent, SolicitudEmpleadorCard, SucursalDetalleModal, Graficos],
  templateUrl: './admin.html',
  styleUrl: './admin.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Administracion {
  private readonly api = inject(solicitudEmpleadorService);
  private readonly sucursalesApi = inject(sucursalService);
  private readonly usuariosApi = inject(usuarioService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly recargar = new Subject<void>();

  private revision = 0;

  /** Filtro y paginación del listado administrativo: los resuelve el backend. */
  protected readonly filtroEstadoSolicitud = signal<EstadoSolicitudEmpleador>('PENDIENTE');
  /** Página solicitada a la API, comenzando en 0. */
  protected readonly paginaSolicitudes = signal(0);
  protected readonly totalSolicitudes = signal(0);
  protected readonly totalPaginasSolicitudes = signal(0);
  protected readonly cargandoPaginaSolicitudes = signal(false);
  protected readonly tamanioPaginaSolicitudes = TAMANO_PAGINA_SOLICITUDES;

  protected readonly solicitudes = signal<readonly SolicitudEmpleadorMiniDTO[]>([]);
  protected readonly detalles = signal<ReadonlyMap<number, SolicitudEmpleadorDetalleDTO>>(new Map());
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly reintentando = signal(false);
  protected readonly expandidas = signal<ReadonlySet<number>>(new Set());
  protected readonly cargandoDetalle = signal<ReadonlySet<number>>(new Set());
  protected readonly erroresDetalle = signal<ReadonlyMap<number, string>>(new Map());
  protected readonly resolviendo = signal<ReadonlyMap<number, AccionSolicitudEmpleador>>(new Map());
  protected readonly erroresAccion = signal<ReadonlyMap<number, string>>(new Map());
  protected readonly exito = signal<string | null>(null);
  protected readonly sucursales = signal<readonly SucursalMiniDTO[]>([]);
  /** Paginación y totales que resuelve el backend; `pagina` es 0-based. */
  protected readonly totalSucursales = signal(0);
  protected readonly totalPaginasSucursales = signal(0);
  protected readonly paginaSucursales = signal(0);
  protected readonly sucursalesCargando = signal(true);
  protected readonly sucursalesError = signal(false);
  protected readonly sucursalesReintentando = signal(false);
  protected readonly busquedaSucursal = signal('');
  protected readonly nombreSucursal = signal('');
  protected readonly categoriaSucursal = signal('');
  protected readonly categoriasSucursal = signal<readonly string[]>([]);
  protected readonly seccionActiva = signal<'sucursales' | 'solicitudes' | 'estadisticas' | 'usuarios' | null>(null);
  protected readonly sucursalDetalleId = signal<number | null>(null);
  private readonly recargarSucursales = new Subject<void>();
  private readonly filtrosUsuarios$ = new Subject<FiltrosUsuariosAdmin>();
  protected readonly usuarios = signal<readonly UsuarioMiniAdminDTO[]>([]);
  protected readonly totalUsuarios = signal(0);
  protected readonly totalPaginasUsuarios = signal(0);
  protected readonly paginaUsuarios = signal(0);
  protected readonly fotosUsuariosFallidas = signal<ReadonlySet<number>>(new Set());
  protected readonly usuariosCargando = signal(true);
  protected readonly usuariosError = signal(false);
  protected readonly usuariosReintentando = signal(false);
  protected readonly filtroEstadoUsuario = signal('todos');
  protected readonly nombreUsuario = signal('');
  protected readonly apellidoUsuario = signal('');
  protected readonly emailUsuario = signal('');
  protected readonly rolUsuario = signal('');
  protected readonly rolesUsuario = ROLES_USUARIO;
  protected readonly usuarioDetalleId = signal<number | null>(null);
  protected readonly usuarioDetalle = signal<UsuarioPerfilDTO | null>(null);
  protected readonly detalleUsuarioCargando = signal(false);
  protected readonly detalleUsuarioError = signal<string | null>(null);
  protected readonly usuarioAEliminar = signal<UsuarioMiniAdminDTO | null>(null);
  protected readonly eliminandoUsuario = signal(false);
  protected readonly errorEliminarUsuario = signal<string | null>(null);
  protected readonly usuarioDetalleEstado = signal<boolean | null>(null);
  protected readonly activandoUsuario = signal(false);
  protected readonly errorActivarUsuario = signal<string | null>(null);
  protected readonly usuarioActualizado = signal<string | null>(null);

  protected readonly total = computed(() => this.totalSolicitudes());
  protected readonly etiquetaTotal = computed(() => {
    const total = this.totalSolicitudes();
    const singular = SINGULAR_ESTADO[this.filtroEstadoSolicitud()];
    return `${total} ${total === 1 ? singular : `${singular}s`}`;
  });
  protected readonly etiquetaFiltro = computed(
    () => `${SINGULAR_ESTADO[this.filtroEstadoSolicitud()]}s`,
  );

  constructor() {
    this.sucursalesApi.categorias()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (categorias) => this.categoriasSucursal.set(categorias),
        error: () => this.categoriasSucursal.set([]),
      });

    this.recargarSucursales
      .pipe(
        startWith(undefined as void),
        switchMap(() => {
          this.sucursalesCargando.set(this.sucursales().length === 0);
          // Nunca se pide una página que el backend ya informó que no existe.
          const pagina = paginaValida(this.paginaSucursales(), this.totalPaginasSucursales());
          if (pagina !== this.paginaSucursales()) this.paginaSucursales.set(pagina);

          const q = this.busquedaSucursal().trim() || null;
          const nombre = this.nombreSucursal().trim() || null;
          const categoria = this.categoriaSucursal() || null;
          return this.sucursalesApi.listarPaginadoAdmin(q, nombre, categoria, pagina).pipe(
            map((pagina): ResultadoSucursales => ({ ok: true, pagina })),
            catchError(() => of<ResultadoSucursales>({ ok: false })),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((resultado) => this.aplicarSucursales(resultado));

    this.recargar
      .pipe(
        startWith(undefined as void),
        switchMap(() => {
          const sinLista = this.solicitudes().length === 0;
          this.cargando.set(sinLista);
          this.cargandoPaginaSolicitudes.set(!sinLista);

          const estado = this.filtroEstadoSolicitud();
          // Nunca se pide una página que el backend ya informó que no existe.
          const ultimaPagina = Math.max(0, this.totalPaginasSolicitudes() - 1);
          const page = Math.min(this.paginaSolicitudes(), ultimaPagina);
          if (page !== this.paginaSolicitudes()) this.paginaSolicitudes.set(page);

          return this.api.listarAdministrativas(estado, page).pipe(
            map((pagina): ResultadoLista => ({ ok: true, pagina })),
            catchError((error: HttpErrorResponse) => of<ResultadoLista>({ ok: false, error })),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((resultado) => this.aplicarLista(resultado));

    this.filtrosUsuarios$
      .pipe(
        startWith(this.filtrosActuales()),
        switchMap((filtros) => {
          this.usuariosCargando.set(this.usuarios().length === 0);
          const pagina = paginaValida(this.paginaUsuarios(), this.totalPaginasUsuarios());
          if (pagina !== this.paginaUsuarios()) this.paginaUsuarios.set(pagina);

          return this.usuariosApi.listarPaginadoAdmin(filtros, pagina).pipe(
            map((pagina): ResultadoUsuarios => ({ ok: true, pagina })),
            catchError(() => of<ResultadoUsuarios>({ ok: false })),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((resultado) => this.aplicarUsuarios(resultado));
  }

  protected detalleDe(id: number): SolicitudEmpleadorDetalleDTO | null {
    return this.detalles().get(id) ?? null;
  }

  protected buscarSucursales(valor: string): void {
    if (valor === this.busquedaSucursal()) return;
    this.busquedaSucursal.set(valor);
    this.reiniciarSucursales();
  }

  protected cambiarNombreSucursales(valor: string): void {
    if (valor === this.nombreSucursal()) return;
    this.nombreSucursal.set(valor);
    this.reiniciarSucursales();
  }

  protected cambiarCategoriaSucursales(valor: string): void {
    if (valor === this.categoriaSucursal()) return;
    this.categoriaSucursal.set(valor);
    this.reiniciarSucursales();
  }

  private reiniciarSucursales(): void {
    this.paginaSucursales.set(0);
    this.recargarSucursales.next();
  }

  /** `ds-pagination` es 1-based; la API usa páginas 0-based. */
  protected cambiarPaginaSucursales(paginaVisible: number): void {
    const destino = paginaValida(paginaVisible - 1, this.totalPaginasSucursales());
    if (destino === this.paginaSucursales()) return;

    this.paginaSucursales.set(destino);
    this.recargarSucursales.next();
  }

  /** `ds-pagination` es 1-based; la API usa páginas 0-based. */
  protected cambiarPaginaUsuarios(paginaVisible: number): void {
    const destino = paginaValida(paginaVisible - 1, this.totalPaginasUsuarios());
    if (destino === this.paginaUsuarios()) return;

    this.paginaUsuarios.set(destino);
    this.filtrosUsuarios$.next(this.filtrosActuales());
  }

  /** Cambia el estado consultado y vuelve siempre a la primera página (0). */
  protected cambiarFiltroEstado(valor: string): void {
    const estado = esEstadoSolicitud(valor) ? valor : 'PENDIENTE';
    if (estado === this.filtroEstadoSolicitud() && this.paginaSolicitudes() === 0) return;

    this.filtroEstadoSolicitud.set(estado);
    this.paginaSolicitudes.set(0);
    this.recargar.next();
  }

  /** `ds-pagination` es 1-based; la API usa páginas 0-based. */
  protected cambiarPaginaSolicitudes(paginaVisible: number): void {
    const ultimaPagina = Math.max(0, this.totalPaginasSolicitudes() - 1);
    const destino = Math.min(Math.max(0, paginaVisible - 1), ultimaPagina);
    if (destino === this.paginaSolicitudes()) return;

    this.paginaSolicitudes.set(destino);
    this.recargar.next();
  }

  protected seleccionarSeccion(seccion: 'sucursales' | 'solicitudes' | 'estadisticas' | 'usuarios'): void {
    this.seccionActiva.update((actual) => (actual === seccion ? null : seccion));
  }

  /** Cambia el estado consultado y vuelve siempre a la primera página (0). */
  protected cambiarFiltroUsuario(valor: string): void {
    const estado = valor === 'activos' || valor === 'inactivos' ? valor : 'todos';
    if (estado === this.filtroEstadoUsuario() && this.paginaUsuarios() === 0) return;

    this.filtroEstadoUsuario.set(estado);
    this.reiniciarUsuarios();
  }

  protected cambiarFiltroTextoUsuario(
    campo: 'nombre' | 'apellido' | 'email',
    valor: string,
  ): void {
    const signal = campo === 'nombre'
      ? this.nombreUsuario
      : campo === 'apellido'
        ? this.apellidoUsuario
        : this.emailUsuario;
    if (signal() === valor) return;

    signal.set(valor);
    this.reiniciarUsuarios();
  }

  protected cambiarFiltroRolUsuario(valor: string): void {
    const rol = ROLES_USUARIO.includes(valor) ? valor : '';
    if (rol === this.rolUsuario()) return;

    this.rolUsuario.set(rol);
    this.reiniciarUsuarios();
  }

  private reiniciarUsuarios(): void {
    this.paginaUsuarios.set(0);
    this.filtrosUsuarios$.next(this.filtrosActuales());
  }

  protected reintentarUsuarios(): void {
    if (this.usuariosReintentando()) return;
    this.usuariosReintentando.set(true);
    this.filtrosUsuarios$.next(this.filtrosActuales());
  }

  protected verDetalleUsuario(id: number): void {
    this.usuarioDetalleId.set(id);
    this.usuarioDetalleEstado.set(this.usuarios().find((usuario) => usuario.id === id)?.estado ?? null);
    this.usuarioDetalle.set(null);
    this.detalleUsuarioError.set(null);
    this.errorActivarUsuario.set(null);
    this.detalleUsuarioCargando.set(true);
    this.usuariosApi.obtenerPerfil(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (detalle) => {
        if (this.usuarioDetalleId() !== id) return;
        this.usuarioDetalle.set(detalle);
        this.detalleUsuarioCargando.set(false);
      },
      error: (error: HttpErrorResponse) => {
        if (this.usuarioDetalleId() !== id) return;
        this.detalleUsuarioCargando.set(false);
        this.detalleUsuarioError.set(error.status === 0
          ? 'No pudimos conectar con el servidor. Revisá tu conexión e intentá de nuevo.'
          : 'No pudimos cargar el detalle del usuario. Intentá de nuevo.');
      },
    });
  }

  protected cerrarDetalleUsuario(): void {
    this.usuarioDetalleId.set(null);
    this.usuarioDetalle.set(null);
    this.usuarioDetalleEstado.set(null);
    this.detalleUsuarioError.set(null);
  }

  protected reintentarDetalleUsuario(): void {
    const id = this.usuarioDetalleId();
    if (id !== null && !this.detalleUsuarioCargando()) this.verDetalleUsuario(id);
  }

  protected solicitarEliminarUsuario(usuario: UsuarioMiniAdminDTO): void {
    this.usuarioAEliminar.set(usuario);
    this.errorEliminarUsuario.set(null);
  }

  protected activarUsuario(id: number): void {
    if (this.activandoUsuario() || this.usuarioDetalleEstado() !== false) return;
    this.activandoUsuario.set(true);
    this.errorActivarUsuario.set(null);
    this.usuariosApi.activarAdmin(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.activandoUsuario.set(false);
        this.usuarioDetalleEstado.set(true);
        this.usuarios.update((usuarios) => usuarios.map((usuario) =>
          usuario.id === id ? { ...usuario, estado: true } : usuario,
        ));
      },
      error: (error: HttpErrorResponse) => {
        this.activandoUsuario.set(false);
        this.errorActivarUsuario.set(error.status === 403
          ? 'No tenés permisos para activar este usuario.'
          : error.status === 404
            ? 'No encontramos esta cuenta.'
            : error.status === 0
              ? 'No pudimos conectar con el servidor. Revisá tu conexión e intentá de nuevo.'
              : 'No pudimos activar el usuario. Intentá de nuevo.');
      },
    });
  }

  protected inicialesUsuario(usuario: UsuarioMiniAdminDTO): string {
    return `${usuario.nombre.trim().charAt(0)}${usuario.apellido.trim().charAt(0)}`.toLocaleUpperCase('es');
  }

  protected fotoUsuario(usuario: UsuarioMiniAdminDTO): string | null {
    const foto = fotoPerfilDe(usuario as UsuarioMiniAdminDTO & { urlFotoPerfil?: string | null; fotoUrl?: string | null });
    return foto && !this.fotosUsuariosFallidas().has(usuario.id) ? foto : null;
  }

  protected marcarFotoUsuarioFallida(id: number): void {
    this.fotosUsuariosFallidas.update((fallidas) => new Set(fallidas).add(id));
  }

  protected cancelarEliminarUsuario(): void {
    if (this.eliminandoUsuario()) return;
    this.usuarioAEliminar.set(null);
    this.errorEliminarUsuario.set(null);
  }

  protected confirmarEliminarUsuario(): void {
    const usuario = this.usuarioAEliminar();
    if (!usuario || this.eliminandoUsuario()) return;
    this.eliminandoUsuario.set(true);
    this.errorEliminarUsuario.set(null);
    this.usuariosApi.eliminarAdmin(usuario.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.eliminandoUsuario.set(false);
        this.usuarioAEliminar.set(null);
        this.usuarioDetalleId.set(null);
        this.usuarioDetalle.set(null);
        this.usuarioActualizado.set(`Se eliminó al usuario ${usuario.nombre} ${usuario.apellido}.`);
        this.filtrosUsuarios$.next(this.filtrosActuales());
      },
      error: (error: HttpErrorResponse) => {
        this.eliminandoUsuario.set(false);
        this.errorEliminarUsuario.set(error.status === 403
          ? 'No tenés permisos para eliminar este usuario.'
          : error.status === 409
            ? 'No se puede eliminar esta cuenta. Revisá si intentás eliminar tu propio usuario administrador.'
            : error.status === 0
              ? 'No pudimos conectar con el servidor. Revisá tu conexión e intentá de nuevo.'
              : 'No pudimos eliminar el usuario. Intentá de nuevo.');
      },
    });
  }

  protected sucursalesDelUsuario(detalle: UsuarioPerfilDTO): string {
    return detalle.sucursalesEmpleado.length
      ? detalle.sucursalesEmpleado.map((sucursal) => sucursal.nombre).join(', ')
      : 'Sin sucursales asociadas';
  }

  private filtrosActuales(): FiltrosUsuariosAdmin {
    const estado = this.filtroEstadoUsuario();
    return {
      nombre: this.nombreUsuario().trim() || undefined,
      apellido: this.apellidoUsuario().trim() || undefined,
      email: this.emailUsuario().trim() || undefined,
      rol: this.rolUsuario() || undefined,
      activo: estado === 'activos' ? true : estado === 'inactivos' ? false : undefined,
    };
  }

  protected reintentarSucursales(): void {
    if (this.sucursalesReintentando()) return;
    this.sucursalesReintentando.set(true);
    this.recargarSucursales.next();
  }

  protected verDetalleSucursal(id: number): void {
    this.sucursalDetalleId.set(id);
  }

  protected cerrarDetalleSucursal(): void {
    this.sucursalDetalleId.set(null);
  }

  protected quitarSucursalEliminada(id: number): void {
    this.sucursalDetalleId.set(null);
    // La baja ya se confirmó en el backend: se recarga la página actual con sus filtros
    // para que el listado y sus totales vuelvan a surgir de la base de datos.
    if (this.sucursales().some((sucursal) => sucursal.id === id)) {
      this.recargarSucursales.next();
    }
  }

  protected estadoDe(id: number): EstadoSolicitudEmpleador | null {
    const detalle = this.detalles().get(id);
    if (detalle) return detalle.estado;

    return (
      this.solicitudes().find((solicitud) => solicitud.id === id)?.estado ??
      this.filtroEstadoSolicitud()
    );
  }

  protected estaExpandida(id: number): boolean {
    return this.expandidas().has(id);
  }

  protected estaCargandoDetalle(id: number): boolean {
    return this.cargandoDetalle().has(id);
  }

  protected errorDetalleDe(id: number): string | null {
    return this.erroresDetalle().get(id) ?? null;
  }

  protected resolviendoDe(id: number): AccionSolicitudEmpleador | null {
    return this.resolviendo().get(id) ?? null;
  }

  protected errorAccionDe(id: number): string | null {
    return this.erroresAccion().get(id) ?? null;
  }

  protected solicitanteDe(solicitud: SolicitudEmpleadorMiniDTO): SolicitanteSolicitudEmpleador {
    return {
      nombre: solicitud.nombreUsuario,
      apellido: solicitud.apellidoUsuario,
    };
  }

  protected alternar(id: number): void {
    const abiertas = new Set(this.expandidas());
    const estabaAbierta = abiertas.has(id);

    if (estabaAbierta) {
      abiertas.delete(id);
    } else {
      abiertas.add(id);
      if (!this.detalles().has(id)) {
        this.cargarDetalle(id);
      }
    }

    this.expandidas.set(abiertas);
  }

  protected reintentarDetalle(id: number): void {
    if (this.cargandoDetalle().has(id)) return;
    this.cargarDetalle(id);
  }

  protected reintentar(): void {
    if (this.reintentando()) return;
    this.reintentando.set(true);
    this.recargar.next();
  }

  protected aprobar(id: number): void {
    this.resolver(id, 'aprobar');
  }

  protected rechazar(id: number): void {
    this.resolver(id, 'rechazar');
  }

  private resolver(id: number, accion: AccionSolicitudEmpleador): void {
    if (this.resolviendo().has(id)) return;

    const detalle = this.detalles().get(id);
    if (!detalle || detalle.estado !== 'PENDIENTE') return;

    this.exito.set(null);
    this.resolviendo.update((actual) => new Map(actual).set(id, accion));
    this.erroresAccion.update((actual) => {
      const siguiente = new Map(actual);
      siguiente.delete(id);
      return siguiente;
    });

    const peticion = accion === 'aprobar' ? this.api.aprobar(id) : this.api.rechazar(id);

    peticion.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        const estado: EstadoSolicitudEmpleador = accion === 'aprobar' ? 'APROBADA' : 'RECHAZADA';

        this.detalles.update((actual) => {
          const solicitud = actual.get(id);
          if (!solicitud) return actual;
          return new Map(actual).set(id, { ...solicitud, estado });
        });
        this.quitarResolviendo(id);
        this.exito.set(
          accion === 'aprobar'
            ? 'La solicitud fue aprobada. La persona ya cuenta con el rol de empleador.'
            : 'La solicitud fue rechazada. La persona va a poder consultar el estado en su historial.',
        );
        // El filtro viene del backend: al resolver, la lista se sincroniza y la
        // solicitud deja de mostrarse en PENDIENTE sin filtrarla localmente.
        this.recargar.next();
      },
      error: (error: HttpErrorResponse) => {
        this.quitarResolviendo(id);
        this.erroresAccion.update((actual) =>
          new Map(actual).set(id, mensajeErrorSolicitud(error, 'resolucion')),
        );
      },
    });
  }

  private quitarResolviendo(id: number): void {
    this.resolviendo.update((actual) => {
      const siguiente = new Map(actual);
      siguiente.delete(id);
      return siguiente;
    });
  }

  private aplicarSucursales(resultado: ResultadoSucursales): void {
    this.sucursalesCargando.set(false);
    this.sucursalesReintentando.set(false);
    this.sucursalesError.set(!resultado.ok);
    if (!resultado.ok) return;

    const { content, totalElements, totalPages, number } = resultado.pagina;
    this.sucursales.set(content);
    this.totalSucursales.set(totalElements);
    this.totalPaginasSucursales.set(totalPages);
    this.paginaSucursales.set(paginaValida(number, totalPages));
  }

  private aplicarUsuarios(resultado: ResultadoUsuarios): void {
    this.usuariosCargando.set(false);
    this.usuariosReintentando.set(false);
    this.usuariosError.set(!resultado.ok);
    if (!resultado.ok) return;

    const { content, totalElements, totalPages, number } = resultado.pagina;
    this.usuarios.set(content);
    this.totalUsuarios.set(totalElements);
    this.totalPaginasUsuarios.set(totalPages);
    this.paginaUsuarios.set(paginaValida(number, totalPages));
  }

  private aplicarLista(resultado: ResultadoLista): void {
    this.revision++;
    this.cargando.set(false);
    this.cargandoPaginaSolicitudes.set(false);
    this.reintentando.set(false);

    if (!resultado.ok) {
      this.error.set(mensajeErrorSolicitud(resultado.error, 'carga'));

      if (this.solicitudes().length === 0) {
        this.detalles.set(new Map());
        this.expandidas.set(new Set());
      }
      return;
    }

    const { content, totalElements, totalPages, number } = resultado.pagina;
    const paginaSegura = Math.min(Math.max(0, number), Math.max(0, totalPages - 1));

    this.error.set(null);
    this.solicitudes.set(content);
    this.totalSolicitudes.set(totalElements);
    this.totalPaginasSolicitudes.set(totalPages);
    this.paginaSolicitudes.set(paginaSegura);
    this.detalles.set(new Map());
    this.erroresDetalle.set(new Map());
    this.erroresAccion.set(new Map());
    this.resolviendo.set(new Map());
    this.cargandoDetalle.set(new Set());
    this.expandidas.set(new Set());
  }

  private cargarDetalle(id: number): void {
    if (this.cargandoDetalle().has(id)) return;

    this.cargandoDetalle.update((actual) => new Set(actual).add(id));
    this.erroresDetalle.update((actual) => {
      const siguiente = new Map(actual);
      siguiente.delete(id);
      return siguiente;
    });

    const revision = this.revision;

    this.api
      .verDetalle(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (detalle) => {
          if (revision !== this.revision) return;

          this.detalles.update((actual) => new Map(actual).set(id, detalle));
          this.cargandoDetalle.update((actual) => {
            const siguiente = new Set(actual);
            siguiente.delete(id);
            return siguiente;
          });
        },
        error: (error: HttpErrorResponse) => {
          if (revision !== this.revision) return;

          this.cargandoDetalle.update((actual) => {
            const siguiente = new Set(actual);
            siguiente.delete(id);
            return siguiente;
          });
          this.erroresDetalle.update((actual) =>
            new Map(actual).set(id, mensajeErrorSolicitud(error, 'detalle')),
          );
        },
      });
  }
}
