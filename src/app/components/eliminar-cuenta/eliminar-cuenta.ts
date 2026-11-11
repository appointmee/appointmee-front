import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { timer } from 'rxjs';

import { DsButtonComponent } from '../../shared/ui/button/button.component';
import { DsModalComponent } from '../../shared/ui/misc/misc.component';
import { authService } from '../../services/auth-service';
import { usuarioService } from '../../services/usuario-service';

/**
 * Sección "Eliminar cuenta" de Ajustes. Reutiliza el endpoint existente
 * `DELETE /usuarios/borrar-cuenta` y exige dos confirmaciones consecutivas
 * antes de invocarlo: solo se llama después de aceptar ambas.
 */
@Component({
  selector: 'app-eliminar-cuenta',
  imports: [DsButtonComponent, DsModalComponent],
  templateUrl: './eliminar-cuenta.html',
  styleUrl: './eliminar-cuenta.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EliminarCuenta {
  private readonly auth = inject(authService);
  private readonly usuarios = inject(usuarioService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  /** Primera confirmación: "¿Estás seguro de eliminar la cuenta?". */
  readonly confirmacionAbierta = signal(false);
  /** Segunda confirmación, independiente de la primera. */
  readonly confirmacionFinalAbierta = signal(false);
  /** Bloquea el inicio de otra eliminación mientras hay una en curso. */
  readonly eliminando = signal(false);
  readonly exito = signal('');
  readonly error = signal('');

  readonly puedeEliminar = computed(() => this.auth.autenticado() && !this.eliminando());

  /** Abre la primera confirmación. Todavía no se toca el backend. */
  solicitarEliminacion(): void {
    if (!this.puedeEliminar()) return;

    this.exito.set('');
    this.error.set('');
    this.confirmacionAbierta.set(true);
  }

  /** Cancela la primera confirmación: no se realiza ninguna acción. */
  cancelarConfirmacion(): void {
    if (this.eliminando()) return;

    this.confirmacionAbierta.set(false);
  }

  /** Acepta la primera confirmación y pasa a la segunda. */
  confirmarPrimerPaso(): void {
    if (this.eliminando()) return;

    this.confirmacionAbierta.set(false);
    this.confirmacionFinalAbierta.set(true);
  }

  /** Cancela la segunda confirmación: no se realiza ninguna acción. */
  cancelarConfirmacionFinal(): void {
    if (this.eliminando()) return;

    this.confirmacionFinalAbierta.set(false);
  }

  /** Acepta la segunda confirmación y ejecuta la eliminación de la cuenta. */
  confirmarEliminacion(): void {
    if (this.eliminando()) return;

    this.eliminando.set(true);
    this.error.set('');

    this.usuarios
      .borrarCuenta()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.finalizarEliminacion(),
        error: (error: unknown) => this.tratarError(error),
      });
  }

  /** Cierra la sesión, avisa el resultado y vuelve al Home sin sesión. */
  private finalizarEliminacion(): void {
    this.eliminando.set(false);
    this.confirmacionFinalAbierta.set(false);
    this.exito.set('Tu cuenta fue eliminada correctamente. Te llevamos al inicio…');

    // La sesión local se limpia con el mecanismo existente; el backend ya
    // revocó las sesiones del usuario al eliminar la cuenta.
    this.auth.limpiarSesion();

    timer(2000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => void this.router.navigate(['/'], { replaceUrl: true }));
  }

  /** Ante un error se conserva la sesión y se informa el problema inline. */
  private tratarError(error: unknown): void {
    this.eliminando.set(false);
    this.confirmacionFinalAbierta.set(false);
    this.error.set(this.mensajeError(error));
  }

  private mensajeError(error: unknown): string {
    const status = error instanceof HttpErrorResponse ? error.status : undefined;

    if (status === 401) {
      return 'Tu sesión expiró. Iniciá sesión nuevamente para eliminar tu cuenta.';
    }

    if (status === 403) {
      return 'Tu cuenta no tiene permiso para eliminar la cuenta.';
    }

    if (status === 0) {
      return 'No pudimos conectar con el servidor. Revisá tu conexión e intentá de nuevo.';
    }

    return 'No pudimos eliminar la cuenta. Intentá de nuevo en unos segundos.';
  }
}
