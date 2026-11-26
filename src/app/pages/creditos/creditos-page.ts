import { ChangeDetectionStrategy, Component } from '@angular/core';

import { Creditos } from '../../components/creditos/creditos';

/** Página pública de créditos, accesible sin iniciar sesión. */
@Component({
  selector: 'app-creditos-page',
  imports: [Creditos],
  templateUrl: './creditos-page.html',
  styleUrl: './creditos-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreditosPage {}
