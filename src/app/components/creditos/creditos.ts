import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Integrantes del equipo, tal como se muestran en los créditos del sistema. */
const INTEGRANTES = [
  { nombre: 'Gonzalo Leonel López', github: 'https://github.com/gonnnza' },
  { nombre: 'Giovanni Morro Bai', github: 'https://github.com/giovannimb1' },
] as const;

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
  /** Presentación sin tarjeta, para insertarse dentro de una sección existente. */
  readonly integrado = input(false);
  /** Si es false, el contenido se muestra sin el contenedor visual propio. */
  readonly tarjeta = input(true);
  readonly integrantes = INTEGRANTES;

  /** Iniciales para el avatar decorativo (nunca reemplazan el nombre accesible). */
  protected iniciales(nombre: string): string {
    return nombre
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((parte) => parte.charAt(0).toLocaleUpperCase('es'))
      .join('');
  }
}
