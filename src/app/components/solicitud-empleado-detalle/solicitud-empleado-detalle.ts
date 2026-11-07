import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import {
  SolicitudEmpleadoDetalleDTO,
  TipoSolicitudEmpleado,
  claseEstadoSolicitudEmpleado,
  etiquetaEstadoSolicitudEmpleado,
  formatearFechaSolicitudEmpleado,
  humanizarCategoria,
  inicialesDeTexto,
} from '../../models/solicitud-empleado';

@Component({
  selector: 'app-solicitud-empleado-detalle',
  imports: [RouterLink],
  templateUrl: './solicitud-empleado-detalle.html',
  styleUrl: './solicitud-empleado-detalle.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SolicitudEmpleadoDetalle {
  readonly detalle = input.required<SolicitudEmpleadoDetalleDTO>();
  readonly tipo = input<TipoSolicitudEmpleado>('recibida');

  protected readonly fecha = computed(() =>
    formatearFechaSolicitudEmpleado(this.detalle().fechaSolicitud),
  );
  protected readonly etiqueta = computed(() =>
    etiquetaEstadoSolicitudEmpleado(this.detalle().estadoSolicitud),
  );
  protected readonly claseEstado = computed(() =>
    claseEstadoSolicitudEmpleado(this.detalle().estadoSolicitud),
  );
  protected readonly nombreEmpleado = computed(() =>
    `${this.detalle().empleado.nombre} ${this.detalle().empleado.apellido}`.trim(),
  );
  protected readonly inicialesEmpleado = computed(() =>
    inicialesDeTexto(this.nombreEmpleado()),
  );
  protected readonly categoria = computed(() =>
    humanizarCategoria(this.detalle().sucursal.categoria),
  );
  protected readonly resumenPuntuacion = computed(() => {
    const sucursal = this.detalle().sucursal;
    if ((sucursal.cantidadPuntuaciones ?? 0) === 0 || sucursal.puntuacion === null) {
      return 'Sin reseñas por ahora';
    }

    const promedio = sucursal.puntuacion.toFixed(1).replace('.', ',');
    return `${promedio} de 5 · ${sucursal.cantidadPuntuaciones} reseñas`;
  });
  protected readonly etiquetaEmpleado = computed(() =>
    this.tipo() === 'recibida' ? 'Tu perfil' : 'Empleado invitado',
  );
  protected readonly notaEstado = computed(() => {
    switch (this.detalle().estadoSolicitud) {
      case 'PENDIENTE':
        return this.tipo() === 'recibida'
          ? 'Todavía podés aceptar o rechazar esta invitación.'
          : 'La invitación está pendiente de respuesta del empleado.';
      case 'APROBADA':
        return 'La invitación fue aceptada y ya no admite cambios.';
      default:
        return 'La invitación fue rechazada y ya no admite cambios.';
    }
  });
}
