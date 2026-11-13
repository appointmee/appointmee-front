import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { EmpleadoDTO } from '../../models/empleado';
import { ServicioDTO } from '../../models/servicio';
import { DisponibilidadDTO } from '../../models/turno';
import { empleadoService } from '../../services/empleado-service';
import { reservaContextoService } from '../../services/reserva-contexto-service';
import { servicioService } from '../../services/servicio-service';
import { turnoService } from '../../services/turno-service';

@Component({
  selector: 'app-profesionales-reserva',
  imports: [RouterLink],
  templateUrl: './profesionales-reserva.html',
  styleUrl: './profesionales-reserva.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfesionalesReserva {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly empleadoService = inject(empleadoService);
  private readonly servicioService = inject(servicioService);
  private readonly turnoService = inject(turnoService);
  private readonly reservaContexto = inject(reservaContextoService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly sucursalId = this.parseId(this.route.snapshot.paramMap.get('sucursalId'));
  protected readonly servicioId = this.parseId(this.route.snapshot.queryParamMap.get('servicioId'));
  protected readonly servicio = signal<ServicioDTO | null>(null);
  protected readonly profesionales = signal<readonly EmpleadoDTO[]>([]);
  protected readonly profesionalSeleccionadoId = signal<number | null>(null);
  protected readonly cargando = signal(true);
  protected readonly contextoInvalido = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly disponibilidad = signal<readonly DisponibilidadDTO[]>([]);
  protected readonly fechaSeleccionada = signal<string | null>(null);
  protected readonly horarioSeleccionado = signal<string | null>(null);
  protected readonly cargandoDisponibilidad = signal(false);
  protected readonly errorDisponibilidad = signal<string | null>(null);
  protected readonly errorReserva = signal<string | null>(null);
  protected readonly reservando = signal(false);
  protected readonly horariosDelDia = computed(() =>
    this.disponibilidad().find((dia) => dia.fecha === this.fechaSeleccionada())?.horarios ?? [],
  );
  protected readonly hayHorariosDisponibles = computed(() =>
    this.disponibilidad().some((dia) => dia.horarios.length > 0),
  );

  protected readonly volverUrl = this.sucursalId !== null
    ? ['/sucursal', this.sucursalId, 'servicios']
    : ['/'];

  protected readonly placeholderAvatar = `data:image/svg+xml;utf8,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240"><rect width="240" height="240" fill="#10151d"/><circle cx="120" cy="92" r="38" fill="#39424f"/><path d="M48 216c9-47 36-72 72-72s63 25 72 72" fill="#39424f"/></svg>',
  )}`;

  constructor() {
    const sucursalId = this.sucursalId;
    const servicioId = this.servicioId;
    if (sucursalId === null || servicioId === null) {
      this.marcarContextoInvalido();
      this.cargando.set(false);
      return;
    }

    const servicioGuardado = this.reservaContexto.servicioSeleccionado(sucursalId);
    if (servicioGuardado !== null && servicioGuardado !== servicioId) {
      this.marcarContextoInvalido();
      this.cargando.set(false);
      return;
    }

    forkJoin({
      servicios: this.servicioService.listarPorSucursal(sucursalId).pipe(catchError(() => of(null))),
      profesionales: this.empleadoService.listarPorSucursal(sucursalId).pipe(catchError(() => of(null))),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ servicios, profesionales }) => {
        const servicio = servicios?.find((item) => item.id === servicioId) ?? null;
        if (!servicio) {
          this.marcarContextoInvalido();
        } else {
          this.servicio.set(servicio);
          this.reservaContexto.guardar(sucursalId, servicioId);
          if (profesionales === null) {
            this.error.set('No pudimos cargar los profesionales. Volvé a intentarlo desde la sucursal.');
          } else {
            this.profesionales.set(profesionales);
          }
        }
        this.cargando.set(false);
      });
  }

  protected elegirProfesional(profesionalId: number): void {
    if (!this.profesionales().some((profesional) => profesional.id === profesionalId)) return;
    this.profesionalSeleccionadoId.set(profesionalId);
    this.fechaSeleccionada.set(null);
    this.horarioSeleccionado.set(null);
    this.errorDisponibilidad.set(null);
    this.errorReserva.set(null);
    this.cargandoDisponibilidad.set(true);
    this.turnoService.disponibilidad(profesionalId, this.servicioId!).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (dias) => {
        this.disponibilidad.set(dias);
        this.fechaSeleccionada.set(dias.find((dia) => dia.horarios.length > 0)?.fecha ?? null);
        this.cargandoDisponibilidad.set(false);
      },
      error: () => {
        this.disponibilidad.set([]);
        this.errorDisponibilidad.set('No pudimos consultar los horarios. Probá elegir este profesional nuevamente.');
        this.cargandoDisponibilidad.set(false);
      },
    });
  }

  protected elegirFecha(fecha: string): void {
    if (!this.disponibilidad().some((dia) => dia.fecha === fecha)) return;
    this.fechaSeleccionada.set(fecha);
    this.horarioSeleccionado.set(null);
  }

  protected elegirHorario(horario: string): void {
    if (!this.horariosDelDia().includes(horario)) return;
    this.horarioSeleccionado.set(horario);
  }

  protected formatoFecha(fecha: string): string {
    const date = new Date(`${fecha}T12:00:00`);
    return new Intl.DateTimeFormat('es-AR', { weekday: 'short', day: 'numeric', month: 'short' }).format(date);
  }

  protected formatoHorario(horario: string): string {
    return horario.slice(0, 5);
  }

  protected foto(profesional: EmpleadoDTO): string {
    return profesional.urlFotoPerfil?.trim() || this.placeholderAvatar;
  }

  protected onFotoError(event: Event): void {
    const imagen = event.target as HTMLImageElement;
    imagen.onerror = null;
    imagen.src = this.placeholderAvatar;
  }

  protected confirmarReserva(): void {
    const empleadoId = this.profesionalSeleccionadoId();
    const fecha = this.fechaSeleccionada();
    const horario = this.horarioSeleccionado();
    if (this.servicioId === null || empleadoId === null || fecha === null || horario === null || this.reservando()) return;

    this.reservando.set(true);
    this.errorReserva.set(null);
    this.turnoService.registrar({
      fechaHora: `${fecha}T${horario.slice(0, 5)}`,
      empleadoId,
      servicioId: this.servicioId,
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.reservaContexto.limpiar();
        void this.router.navigateByUrl('/reserva/confirmada', { state: { reservaConfirmada: true } });
      },
      error: (error: { status?: number }) => {
        this.reservando.set(false);
        this.errorReserva.set(error.status === 409
          ? 'Ese horario acaba de ocuparse. Elegí otro para continuar.'
          : 'No pudimos confirmar la reserva. Tu selección sigue guardada; intentá nuevamente.');
      },
    });
  }

  protected cancelarReserva(): void {
    this.reservaContexto.limpiar();
    void this.router.navigate(this.sucursalId !== null ? ['/sucursal', this.sucursalId] : ['/'], {
      queryParams: { reserva: 'cancelada' },
    });
  }

  private marcarContextoInvalido(): void {
    this.contextoInvalido.set(true);
    this.reservaContexto.limpiar();
  }

  private parseId(value: string | null): number | null {
    if (!value?.trim()) return null;
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
  }
}
