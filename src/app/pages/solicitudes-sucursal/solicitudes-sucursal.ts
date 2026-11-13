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
import { sucursalService } from '../../services/sucursal-service';
import { solicitudEmpleadoService } from '../../services/solicitud-empleado-service';

const SOLICITUDES_VISIBLES = 3;

@Component({
  selector: 'app-solicitudes-sucursal',
  imports: [RouterLink, SolicitudEmpleadoLista],
  templateUrl: './solicitudes-sucursal.html',
  styleUrl: './solicitudes-sucursal.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SolicitudesSucursal {
  private readonly sucursalesApi = inject(sucursalService);
  private readonly solicitudesApi = inject(solicitudEmpleadoService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly recargarEnviadas = new Subject<void>();

  protected readonly sucursalId = Number(
    this.route.snapshot.paramMap.get('sucursalId') ?? '',
  );
  private readonly sucursalValida =
    Number.isInteger(this.sucursalId) && this.sucursalId > 0;

  protected readonly email = signal('');
  protected readonly fotoSucursal = signal<string | null>(null);
  protected readonly enviando = signal(false);
  protected readonly errorEnvio = signal<string | null>(null);
  protected readonly exitoEnvio = signal<string | null>(null);

  protected readonly solicitudesEnviadas = signal<readonly SolicitudEmpleadoVista[]>([]);
  protected readonly cargandoEnviadas = signal(false);
  protected readonly errorEnviadas = signal<string | null>(null);
  protected readonly reintentandoEnviadas = signal(false);

  protected readonly visiblesEnviadas = computed(() =>
    this.solicitudesEnviadas().slice(0, SOLICITUDES_VISIBLES),
  );
  protected readonly hayMasEnviadas = computed(
    () => this.solicitudesEnviadas().length > SOLICITUDES_VISIBLES,
  );

  constructor() {
    if (!this.sucursalValida) {
      this.errorEnvio.set('No pudimos identificar la sucursal solicitada.');
      this.cargandoEnviadas.set(false);
      return;
    }

    this.sucursalesApi
      .obtenerPorId(this.sucursalId, true)
      .pipe(
        map((sucursal) => sucursal.fotoPerfil?.trim() || null),
        catchError(() => of(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((foto) => this.fotoSucursal.set(foto));

    this.recargarEnviadas
      .pipe(
        startWith(undefined as void),
        switchMap(() => {
          if (!this.sucursalValida) return of<readonly SolicitudEmpleadoVista[]>([]);
          this.cargandoEnviadas.set(this.solicitudesEnviadas().length === 0);
          this.errorEnviadas.set(null);
          return this.solicitudesApi.listarEnviadas(this.sucursalId).pipe(
            map((solicitudes) => solicitudes.map(vistaSolicitudEnviada)),
            catchError((error: HttpErrorResponse) => {
              this.errorEnviadas.set(mensajeErrorSolicitudEmpleado(error, 'carga'));
              this.cargandoEnviadas.set(false);
              this.reintentandoEnviadas.set(false);
              return of<readonly SolicitudEmpleadoVista[]>([]);
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((solicitudes) => {
        this.solicitudesEnviadas.set(solicitudes);
        this.cargandoEnviadas.set(false);
        this.reintentandoEnviadas.set(false);
      });
  }

  protected enviarSolicitud(): void {
    const correo = this.email().trim();
    if (!this.sucursalValida || !correo || this.enviando()) return;

    this.enviando.set(true);
    this.errorEnvio.set(null);
    this.exitoEnvio.set(null);

    this.sucursalesApi
      .agregarEmpleado(this.sucursalId, correo)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.enviando.set(false);
          this.exitoEnvio.set('La solicitud de incorporación se envió correctamente.');
          this.email.set('');
          this.recargarEnviadas.next();
        },
        error: (error: HttpErrorResponse) => {
          this.enviando.set(false);
          this.errorEnvio.set(mensajeErrorSolicitudEmpleado(error, 'envio'));
        },
      });
  }

  protected reintentarEnviadas(): void {
    if (this.reintentandoEnviadas()) return;
    this.reintentandoEnviadas.set(true);
    this.recargarEnviadas.next();
  }

  protected marcarFotoSucursalFallida(): void {
    this.fotoSucursal.set(null);
  }

  protected readonly volverLink = ['/mis-sucursales'];
}
