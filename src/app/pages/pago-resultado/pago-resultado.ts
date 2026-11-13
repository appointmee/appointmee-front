import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ResultadoPago } from '../resultado-pago/resultado-pago';

@Component({
  selector: 'app-pago-resultado',
  imports: [RouterLink],
  templateUrl: '../resultado-pago/resultado-pago.html',
  styleUrl: '../resultado-pago/resultado-pago.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PagoResultado extends ResultadoPago {}