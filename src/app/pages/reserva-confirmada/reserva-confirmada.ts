import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-reserva-confirmada',
  imports: [RouterLink],
  template: `
    <main class="confirmacion">
      @if (confirmada) {
        <span class="confirmacion__icono" aria-hidden="true">✓</span>
        <h1>¡Tu turno está reservado!</h1>
        <p>La reserva se registró correctamente. Podés consultarla desde Mis Turnos.</p>
        <a class="boton" routerLink="/mis-turnos">Ir a Mis Turnos</a>
      } @else {
        <h1>No encontramos una confirmación de reserva</h1>
        <p>Revisá tus turnos o volvé al detalle de una sucursal para iniciar una reserva.</p>
        <a class="boton" routerLink="/mis-turnos">Ver Mis Turnos</a>
      }
    </main>
  `,
  styles: `
    :host { display:block; }
    .confirmacion { min-height:calc(100dvh - var(--nav-h)); display:grid; justify-items:center; align-content:center; gap:16px; padding:40px 24px; text-align:center; }
    .confirmacion h1, .confirmacion p { margin:0; }
    .confirmacion p { max-width:520px; color:var(--muted); line-height:1.6; }
    .confirmacion__icono { display:grid; place-items:center; width:64px; height:64px; border-radius:50%; background:var(--accent); color:#211704; font-size:32px; font-weight:800; }
    .boton { display:inline-flex; align-items:center; justify-content:center; min-height:44px; padding:0 20px; border-radius:12px; background:var(--accent); color:#211704; font-weight:700; text-decoration:none; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReservaConfirmada {
  private readonly router = inject(Router);
  protected readonly confirmada = this.router.getCurrentNavigation()?.extras.state?.['reservaConfirmada'] === true
    || globalThis.history?.state?.reservaConfirmada === true;
}
