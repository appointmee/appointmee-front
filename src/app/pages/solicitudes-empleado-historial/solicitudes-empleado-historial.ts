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

import { SolicitudEmpleadoLista } from '../../components/solicitud-empleado-lista/solicitud-empleado-lista';
import { mensajeErrorSolicitudEmpleado } from '../../http/solicitud-empleado-errors';
import {
  ResultadoResolucionSolicitudEmpleado,
  SolicitudEmpleadoVista,
  vistaSolicitudRecibida,
} from '../../models/solicitud-empleado';
import { solicitudEmpleadoService } from '../../services/solicitud-empleado-service';

type ResultadoLista =
  | { readonly ok: true; readonly solicitudes: readonly SolicitudEmpleadoVista[] }
  | { readonly ok: false; readonly error: HttpErrorResponse };

@Component({
  selector: 'app-solicitudes-empleado-historial',
  imports: [RouterLink, SolicitudEmpleadoLista],
  templateUrl: './solicitudes-empleado-historial.html',
  styleUrl: './solicitudes-empleado-historial.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SolicitudesEmpleadoHistorial {
  private readonly api = inject(solicitudEmpleadoService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly recargar = new Subject<void>();

  protected readonly solicitudes = signal<readonly SolicitudEmpleadoVista[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly reintentando = signal(false);
  protected readonly exito = signal<string | null>(null);

  protected readonly total = computed(() => this.solicitudes().length);

  constructor() {
    this.recargar
      .pipe(
        startWith(undefined as void),
        switchMap(() => {
          this.cargando.set(this.solicitudes().length === 0);
          return this.api.listarRecibidas().pipe(
            map(
              (solicitudes): ResultadoLista => ({
                ok: true,
                solicitudes: solicitudes.map(vistaSolicitudRecibida),
              }),
            ),
            catchError((error: HttpErrorResponse) => of<ResultadoLista>({ ok: false, error })),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((resultado) => this.aplicarLista(resultado));
  }

  protected reintentar(): void {
    if (this.reintentando()) return;
    this.reintentando.set(true);
    this.recargar.next();
  }

  protected onSolicitudResuelta(resultado: ResultadoResolucionSolicitudEmpleado): void {
    this.exito.set(
      resultado.accion === 'aprobar'
        ? 'Aceptaste la invitación de empleo. Ya formás parte del equipo de la sucursal.'
        : 'Rechazaste la invitación de empleo. La sucursal va a poder ver tu respuesta.',
    );
  }

  private aplicarLista(resultado: ResultadoLista): void {
    if (!resultado.ok) {
      this.error.set(mensajeErrorSolicitudEmpleado(resultado.error, 'carga'));
      this.cargando.set(false);
      this.reintentando.set(false);

      if (this.solicitudes().length === 0) {
        this.solicitudes.set([]);
      }
      return;
    }

    this.error.set(null);
    this.exito.set(null);
    this.solicitudes.set(resultado.solicitudes);
    this.cargando.set(false);
    this.reintentando.set(false);
  }
}
