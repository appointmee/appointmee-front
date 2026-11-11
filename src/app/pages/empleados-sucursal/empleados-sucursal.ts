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

import { mensajeErrorSolicitudEmpleado } from '../../http/solicitud-empleado-errors';
import { authService } from '../../services/auth-service';
import { sucursalService } from '../../services/sucursal-service';

@Component({
  selector: 'app-empleados-sucursal',
  imports: [RouterLink],
  templateUrl: './empleados-sucursal.html',
  styleUrl: './empleados-sucursal.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmpleadosSucursal {
  private readonly sucursalesApi = inject(sucursalService);
  private readonly auth = inject(authService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly sucursalId = Number(
    this.route.snapshot.paramMap.get('sucursalId') ?? '',
  );

  protected readonly sucursalIdValido =
    Number.isInteger(this.sucursalId) && this.sucursalId > 0;

  protected readonly verificandoEmpleado = signal(false);
  protected readonly yaEsEmpleado = signal(false);
  protected readonly agregandome = signal(false);
  protected readonly errorAgregarme = signal<string | null>(null);

  protected readonly nombreSucursal = signal<string | null>(null);

  constructor() {
    if (!this.sucursalIdValido) {
      this.errorAgregarme.set('No pudimos identificar la sucursal solicitada.');
      return;
    }

    this.verificandoEmpleado.set(true);
    this.sucursalesApi
      .listarEmpleados(this.sucursalId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (empleados) => {
          const perfil = this.auth.perfil();
          this.yaEsEmpleado.set(
            empleados.some(
              (empleado) =>
                empleado.id === perfil?.id ||
                empleado.email.trim().toLowerCase() ===
                  perfil?.email?.trim().toLowerCase(),
            ),
          );
          this.verificandoEmpleado.set(false);
        },
        error: () => {
          this.verificandoEmpleado.set(false);
          this.errorAgregarme.set(
            'No pudimos comprobar si ya formás parte del equipo. Podés intentar agregarte; el sistema evitará duplicados.',
          );
        },
      });
  }

  protected agregarmeComoEmpleado(): void {
    if (this.agregandome() || this.yaEsEmpleado() || !this.sucursalIdValido) return;

    this.agregandome.set(true);
    this.errorAgregarme.set(null);

    this.sucursalesApi
      .convertirmeEnEmpleado(this.sucursalId)
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
          this.errorAgregarme.set(
            mensajeErrorSolicitudEmpleado(error, 'auto-incorporacion'),
          );
        },
      });
  }

  protected readonly volverLink = ['/mis-sucursales'];
}