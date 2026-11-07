import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject, catchError, distinctUntilChanged, forkJoin, map, of, startWith, switchMap } from 'rxjs';
import { LoginModal } from '../../components/login-modal/login-modal';
import { EmpleadoDTO } from '../../models/empleado';
import { ServicioDTO } from '../../models/servicio';
import { DisponibilidadDTO, HorarioSeleccionado } from '../../models/turno';
import { authService } from '../../services/auth-service';
import { empleadoService } from '../../services/empleado-service';
import { servicioService } from '../../services/servicio-service';
import { turnoService } from '../../services/turno-service';

@Component({
  selector: 'app-elegir-turno',
  imports: [RouterLink, LoginModal],
  templateUrl: './elegir-turno.html',
  styleUrl: './elegir-turno.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ElegirTurno {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private auth = inject(authService);
  private serviciosApi = inject(servicioService);
  private empleadosApi = inject(empleadoService);
  private turnosApi = inject(turnoService);
  private destroyRef = inject(DestroyRef);
  private recargar = new Subject<void>();
  private cambiarEmpleado = new Subject<number>();
  private ultimoBoton: HTMLElement | null = null;

  sucursalId = signal(0);
  servicioId = signal(0);
  servicio = signal<ServicioDTO | null>(null);
  empleados = signal<readonly EmpleadoDTO[]>([]);
  empleadoId = signal(0);
  disponibilidad = signal<readonly DisponibilidadDTO[]>([]);
  seleccionado = signal<HorarioSeleccionado | null>(null);
  cargando = signal(true);
  cargandoHorarios = signal(false);
  error = signal('');
  errorHorarios = signal('');
  aviso = signal('');
  loginAbierto = signal(false);

  destinoRetorno = computed(() => {
    const seleccionado = this.seleccionado();
    return this.router.serializeUrl(this.router.createUrlTree(
      ['/sucursal', this.sucursalId(), 'servicios', this.servicioId(), 'turnos'],
      { queryParams: seleccionado ?? {} },
    ));
  });

  constructor() {
    this.cambiarEmpleado.pipe(
      switchMap(id => {
        this.cargandoHorarios.set(true);
        this.errorHorarios.set('');
        this.disponibilidad.set([]);
        return this.turnosApi.disponibilidad(id, this.servicioId()).pipe(
          map(dias => ({ dias, error: '' })),
          catchError(() => of({ dias: [], error: 'No pudimos cargar los horarios. Revisá tu conexión y reintentá.' })),
        );
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(resultado => {
      this.cargandoHorarios.set(false);
      this.errorHorarios.set(resultado.error);
      this.disponibilidad.set(resultado.dias);
      const query = this.route.snapshot.queryParamMap;
      const fecha = query.get('fecha');
      const hora = query.get('hora');
      if (Number(query.get('empleadoId')) === this.empleadoId()
          && fecha && hora && resultado.dias.some(dia => dia.fecha === fecha && dia.horarios.includes(hora))) {
        this.seleccionado.set({ empleadoId: this.empleadoId(), fecha, hora });
      }
    });

    this.route.paramMap.pipe(
      map(params => ({ sucursalId: Number(params.get('sucursalId')), servicioId: Number(params.get('servicioId')) })),
      distinctUntilChanged((a, b) => a.sucursalId === b.sucursalId && a.servicioId === b.servicioId),
      switchMap(ids => this.recargar.pipe(startWith(undefined), map(() => ids))),
      switchMap(ids => {
        this.sucursalId.set(ids.sucursalId);
        this.servicioId.set(ids.servicioId);
        this.cargando.set(true);
        this.error.set('');
        this.seleccionado.set(null);
        this.disponibilidad.set([]);
        this.aviso.set('');
        if (![ids.sucursalId, ids.servicioId].every(id => Number.isInteger(id) && id > 0)) {
          return of({ servicio: null, empleados: [], error: 'No encontramos el servicio o la sucursal.' });
        }
        return forkJoin({
          servicios: this.serviciosApi.listarPorSucursal(ids.sucursalId),
          empleados: this.empleadosApi.listarPorSucursal(ids.sucursalId),
        }).pipe(
          map(datos => ({
            servicio: datos.servicios.find(servicio => servicio.id === ids.servicioId) ?? null,
            empleados: datos.empleados,
            error: '',
          })),
          catchError(() => of({ servicio: null, empleados: [], error: 'No pudimos cargar el servicio. Revisá tu conexión y reintentá.' })),
        );
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(resultado => {
      this.cargando.set(false);
      this.servicio.set(resultado.servicio);
      this.empleados.set(resultado.empleados);
      if (resultado.error || !resultado.servicio) {
        this.error.set(resultado.error || 'Este servicio no pertenece a la sucursal o ya no está disponible.');
        return;
      }
      const previo = Number(this.route.snapshot.queryParamMap.get('empleadoId'));
      const elegido = resultado.empleados.find(empleado => empleado.id === previo) ?? resultado.empleados[0];
      if (elegido) this.elegirEmpleado(elegido.id);
    });
  }

  elegirEmpleado(id: number): void {
    if (!this.empleados().some(empleado => empleado.id === id)) return;
    this.empleadoId.set(id);
    this.seleccionado.set(null);
    this.aviso.set('');
    this.cambiarEmpleado.next(id);
  }

  cambiarProfesional(event: Event): void {
    this.elegirEmpleado(Number((event.target as HTMLSelectElement).value));
  }

  elegirHorario(fecha: string, hora: string, event: Event): void {
    if (this.cargandoHorarios() || !this.disponibilidad().some(dia => dia.fecha === fecha && dia.horarios.includes(hora))) return;
    this.ultimoBoton = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
    this.seleccionado.set({ empleadoId: this.empleadoId(), fecha, hora });
    this.aviso.set('');
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { empleadoId: this.empleadoId(), fecha, hora },
      replaceUrl: true,
    });

    if (!this.auth.autenticado()) {
      this.loginAbierto.set(true);
      return;
    }
    this.continuar();
  }

  continuar(): void {
    this.cerrarLogin();
    this.aviso.set(this.auth.tieneAlgunRol('CLIENTE')
      ? 'Horario seleccionado. La confirmación de la reserva está en construcción; todavía no se creó ningún turno.'
      : 'Necesitás una cuenta con rol Cliente para reservar. Podés seguir consultando los horarios.');
  }

  cerrarLogin(): void {
    this.loginAbierto.set(false);
    queueMicrotask(() => this.ultimoBoton?.focus());
  }

  reintentar(): void {
    if (!this.cargando()) this.recargar.next();
  }

  reintentarHorarios(): void {
    if (!this.cargandoHorarios() && this.empleadoId()) this.cambiarEmpleado.next(this.empleadoId());
  }
}
