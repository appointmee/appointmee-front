import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, map, of, startWith, switchMap } from 'rxjs';

import { TurnoMiniDTO } from '../../models/turno';
import { turnoService } from '../../services/turno-service';

@Component({
  selector: 'app-mis-turnos',
  imports: [],
  templateUrl: './mis-turnos.html',
  styleUrl: './mis-turnos.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MisTurnos {
  private readonly api = inject(turnoService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly recargar = new Subject<void>();

  protected readonly turnos = signal<readonly TurnoMiniDTO[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly reintentando = signal(false);

  constructor() {
    this.recargar
      .pipe(
        startWith(undefined as void),
        switchMap(() => {
          this.cargando.set(this.turnos().length === 0);
          this.error.set(null);
          return this.api.propios().pipe(
            map((turnos) => ({ ok: true as const, turnos })),
            catchError((err: HttpErrorResponse) =>
              of({ ok: false as const, error: err }),
            ),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((res) => {
        this.cargando.set(false);
        this.reintentando.set(false);
        if (res.ok) {
          this.turnos.set(res.turnos);
        } else {
          this.error.set('No pudimos cargar tus turnos. Intentá nuevamente.');
        }
      });
  }

  protected reintentar(): void {
    if (this.reintentando()) return;
    this.reintentando.set(true);
    this.recargar.next();
  }
}
