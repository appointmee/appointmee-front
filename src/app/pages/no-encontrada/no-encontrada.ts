import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Vista 404 (US-ERR-04).
 * Se muestra cuando la ruta no existe: nunca una pantalla en blanco ni el error
 * del servidor. La info técnica se queda de lado (criterio 3).
 */
@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  templateUrl: './no-encontrada.html',
  styleUrl: './no-encontrada.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFoundPage {}
