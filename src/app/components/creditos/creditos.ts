import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Integrantes del equipo, tal como se muestran en los créditos del sistema. */
const INTEGRANTES = ['Gonzalo Leonel López', 'Giovanni Morro Bai'] as const;

/** Créditos del sistema: contenido estático, sin endpoints ni dependencia de roles. */
@Component({
  selector: 'app-creditos',
  templateUrl: './creditos.html',
  styleUrl: './creditos.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Creditos {
  readonly titulo = input('Créditos del sistema');
  /** Nivel del encabezado para encajar en la jerarquía de cada pantalla. */
  readonly nivel = input<2 | 3>(2);
  readonly integrantes = INTEGRANTES;
}
