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
  SolicitudEmpleadoMiniSucursalDTO,
  SolicitudEmpleadoVista,
  vistaSolicitudEnviada,
  humanizarCategoria,
} from '../../models/solicitud-empleado';
import { SucursalMiniDTO } from '../../models/sucursal';
import { authService } from '../../services/auth-service';
import { solicitudEmpleadoService } from '../../services/solicitud-empleado-service';
import { sucursalService } from '../../services/sucursal-service';

const SOLICITUDES_VISIBLES = 3;

@Component({
  selector: 'app-mis-sucursales',
  imports: [RouterLink, SolicitudEmpleadoLista],
  templateUrl: './mis-sucursales.html',
  styleUrl: './mis-sucursales.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MisSucursales {
  private readonly sucursalesApi = inject(sucursalService);
  private readonly solicitudesApi = inject(solicitudEmpleadoService);
  private readonly auth = inject(authService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly recargar = new Subject<void>();

  protected readonly sucursales = signal<readonly SucursalMiniDTO[]>([]);
  protected readonly cargandoSucursales = signal(true);
  protected readonly errorSucursales = signal<string | null>(null);
  protected readonly reintentandoSucursales = signal(false);

  protected readonly sucursalSeleccionadaId = signal<number | null>(null);
  protected readonly verificandoEmpleado = signal(false);
  protected readonly yaEsEmpleado = signal(false);
  protected readonly agregandome = signal(false);
  protected readonly errorAgregarme = signal<string | null>(null);

  protected readonly email = signal('');

  protected readonly enviando = signal(false);
  protected readonly errorEnvio = signal<string | null>(null);
  protected readonly exitoEnvio = signal<string | null>(null);

  protected readonly solicitudesEnviadas = signal<readonly SolicitudEmpleadoVista[]>([]);
  protected readonly cargandoEnviadas = signal(false);
  protected readonly errorEnviadas = signal<string | null>(null);
  protected readonly reintentandoEnviadas = signal(false);

  protected readonly sucursalSeleccionada = computed(() =>
    this.sucursales().find((sucursal) => sucursal.id === this.sucursalSeleccionadaId()) ?? null,
  );

  protected readonly visiblesEnviadas = computed(() =>
    this.solicitudesEnviadas().slice(0, SOLICITUDES_VISIBLES),
  );
  protected readonly hayMasEnviadas = computed(
    () => this.solicitudesEnviadas().length > SOLICITUDES_VISIBLES,
  );

  protected readonly humanizarCategoria = humanizarCategoria;

  constructor() {
    this.recargar
      .pipe(
        startWith(undefined as void),
        switchMap(() => {
          this.cargandoSucursales.set(this.sucursales().length === 0);
          return this.sucursalesApi.listarPropias().pipe(
            map((sucursales) => ({ ok: true as const, sucursales })),
            catchError((error: HttpErrorResponse) =>
              of({ ok: false as const, error }),
            ),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((resultado) => {
        if (!resultado.ok) {
          this.errorSucursales.set(
            mensajeErrorSolicitudEmpleado(resultado.error, 'sucursales'),
          );
          this.cargandoSucursales.set(false);
          this.reintentandoSucursales.set(false);
          return;
        }

        this.errorSucursales.set(null);
        this.sucursales.set(resultado.sucursales);
        this.cargandoSucursales.set(false);
        this.reintentandoSucursales.set(false);
      });
  }

  protected reintentarSucursales(): void {
    if (this.reintentandoSucursales()) return;
    this.reintentandoSucursales.set(true);
    this.recargar.next();
  }

  protected seleccionarSucursal(id: number): void {
    this.sucursalSeleccionadaId.set(id);
    this.limpiarFormulario();
    this.limpiarEstadoEmpleado();
    this.verificandoEmpleado.set(true);
    this.cargarEstadoEmpleado(id);
    this.cargarEnviadas(id);
  }

  protected volverALista(): void {
    this.sucursalSeleccionadaId.set(null);
    this.limpiarFormulario();
    this.limpiarEstadoEmpleado();
  }

  protected agregarmeComoEmpleado(): void {
    const sucursalId = this.sucursalSeleccionadaId();
    if (sucursalId === null || this.agregandome() || this.yaEsEmpleado()) return;

    this.agregandome.set(true);
    this.errorAgregarme.set(null);

    this.sucursalesApi
      .convertirmeEnEmpleado(sucursalId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.agregandome.set(false);
          this.yaEsEmpleado.set(true);
        },
        error: (error: HttpErrorResponse) => {
          this.agregandome.set(false);
          if (error.status === 409) {
            this.yaEsEmpleado.set(true);
            return;
          }
          this.errorAgregarme.set(mensajeErrorSolicitudEmpleado(error, 'auto-incorporacion'));
        },
      });
  }

  protected enviarSolicitud(): void {
    const sucursalId = this.sucursalSeleccionadaId();
    const correo = this.email().trim();
    if (!sucursalId || !correo || this.enviando()) return;

    this.enviando.set(true);
    this.errorEnvio.set(null);
    this.exitoEnvio.set(null);

    this.sucursalesApi
      .agregarEmpleado(sucursalId, correo)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.enviando.set(false);
          this.exitoEnvio.set('La solicitud de incorporación se envió correctamente.');
          this.limpiarFormulario();
          this.cargarEnviadas(sucursalId);
        },
        error: (error: HttpErrorResponse) => {
          this.enviando.set(false);
          this.errorEnvio.set(mensajeErrorSolicitudEmpleado(error, 'envio'));
        },
      });
  }

  protected reintentarEnviadas(): void {
    const id = this.sucursalSeleccionadaId();
    if (id === null || this.reintentandoEnviadas()) return;
    this.reintentandoEnviadas.set(true);
    this.cargarEnviadas(id, true);
  }

  private cargarEnviadas(sucursalId: number, reintento = false): void {
    if (!reintento) {
      this.cargandoEnviadas.set(this.solicitudesEnviadas().length === 0);
    }
    this.errorEnviadas.set(null);

    this.solicitudesApi
      .listarEnviadas(sucursalId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (solicitudes) => {
          this.solicitudesEnviadas.set(solicitudes.map(vistaSolicitudEnviada));
          this.cargandoEnviadas.set(false);
          this.reintentandoEnviadas.set(false);
        },
        error: (error: HttpErrorResponse) => {
          this.errorEnviadas.set(mensajeErrorSolicitudEmpleado(error, 'carga'));
          this.cargandoEnviadas.set(false);
          this.reintentandoEnviadas.set(false);
        },
      });
  }

  private cargarEstadoEmpleado(sucursalId: number): void {
    this.sucursalesApi
      .listarEmpleados(sucursalId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (empleados) => {
          if (this.sucursalSeleccionadaId() !== sucursalId) return;
          const perfil = this.auth.perfil();
          this.yaEsEmpleado.set(
            empleados.some(
              (empleado) =>
                empleado.id === perfil?.id ||
                empleado.email.trim().toLowerCase() === perfil?.email?.trim().toLowerCase(),
            ),
          );
          this.verificandoEmpleado.set(false);
        },
        error: () => {
          if (this.sucursalSeleccionadaId() !== sucursalId) return;
          this.verificandoEmpleado.set(false);
          this.errorAgregarme.set(
            'No pudimos comprobar si ya formás parte del equipo. Podés intentar agregarte; el sistema evitará duplicados.',
          );
        },
      });
  }

  private limpiarEstadoEmpleado(): void {
    this.verificandoEmpleado.set(false);
    this.yaEsEmpleado.set(false);
    this.agregandome.set(false);
    this.errorAgregarme.set(null);
  }

  private limpiarFormulario(): void {
    this.email.set('');
    this.errorEnvio.set(null);
    this.exitoEnvio.set(null);
  }
}
