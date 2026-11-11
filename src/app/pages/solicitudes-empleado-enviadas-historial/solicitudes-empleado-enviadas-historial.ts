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
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subject, catchError, map, of, startWith, switchMap } from 'rxjs';

import { SolicitudEmpleadoLista } from '../../components/solicitud-empleado-lista/solicitud-empleado-lista';
import { mensajeErrorSolicitudEmpleado } from '../../http/solicitud-empleado-errors';
import {
  SolicitudEmpleadoVista,
  vistaSolicitudEnviada,
} from '../../models/solicitud-empleado';
import { solicitudEmpleadoService } from '../../services/solicitud-empleado-service';

@Component({
  selector: 'app-solicitudes-empleado-enviadas-historial',
  imports: [RouterLink, SolicitudEmpleadoLista],
  templateUrl: './solicitudes-empleado-enviadas-historial.html',
  styleUrl: './solicitudes-empleado-enviadas-historial.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SolicitudesEmpleadoEnviadasHistorial {
  private readonly api = inject(solicitudEmpleadoService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly recargar = new Subject<void>();

  protected readonly sucursalId = signal<number | null>(null);
  protected readonly solicitudes = signal<readonly SolicitudEmpleadoVista[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly reintentando = signal(false);

  protected readonly total = computed(() => this.solicitudes().length);

  constructor() {
    this.route.paramMap
      .pipe(
        map((params) => {
          const id = Number(params.get('sucursalId'));
          return Number.isInteger(id) && id > 0 ? id : null;
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((id) => {
        this.sucursalId.set(id);
        this.solicitudes.set([]);
        this.error.set(null);
        this.cargando.set(true);
        this.recargar.next();
      });

    this.recargar
      .pipe(
        startWith(undefined as void),
        switchMap(() => {
          const id = this.sucursalId();
          if (id === null) {
            this.cargando.set(false);
            return of<readonly SolicitudEmpleadoVista[]>([]);
          }
          this.cargando.set(this.solicitudes().length === 0);
          return this.api.listarEnviadas(id).pipe(
            map((solicitudes) => solicitudes.map(vistaSolicitudEnviada)),
            catchError((error: HttpErrorResponse) => {
              this.error.set(mensajeErrorSolicitudEmpleado(error, 'carga'));
              this.cargando.set(false);
              this.reintentando.set(false);
              return of<readonly SolicitudEmpleadoVista[]>([]);
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((solicitudes) => {
        this.solicitudes.set(solicitudes);
        this.cargando.set(false);
        this.reintentando.set(false);
      });
  }

  protected reintentar(): void {
    if (this.reintentando()) return;
    this.reintentando.set(true);
    this.recargar.next();
  }
}
