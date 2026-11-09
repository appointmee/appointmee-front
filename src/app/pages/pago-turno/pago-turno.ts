import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

const FORMATO_FECHA_COMPLETA = new Intl.DateTimeFormat('es-AR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

/**
 * Paso final provisorio del flujo de reserva. La integración real de pago se
 * implementará en otra historia; esta pantalla sólo confirma la selección y
 * permite volver al paso anterior sin perderla.
 */
@Component({
  selector: 'app-pago-turno',
  imports: [RouterLink],
  templateUrl: './pago-turno.html',
  styleUrl: './pago-turno.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PagoTurno {
  private readonly route = inject(ActivatedRoute);

  protected readonly sucursalId = this.parseId(
    this.route.snapshot.paramMap.get('sucursalId'),
  );
  protected readonly servicioId = this.parseId(
    this.route.snapshot.paramMap.get('servicioId'),
  );
  protected readonly empleadoId = this.parseId(
    this.route.snapshot.queryParamMap.get('empleadoId'),
  );
  private readonly fecha = this.route.snapshot.queryParamMap.get('fecha');
  private readonly hora = this.route.snapshot.queryParamMap.get('hora');

  protected readonly sinContexto = computed(
    () =>
      this.sucursalId === null ||
      this.servicioId === null ||
      this.empleadoId === null ||
      !this.fecha ||
      !this.hora,
  );

  protected readonly volverLink = computed<readonly (string | number)[]>(() =>
    this.sucursalId !== null && this.servicioId !== null
      ? ['/sucursal', this.sucursalId, 'servicios', this.servicioId, 'turnos']
      : ['/'],
  );

  protected readonly volverQueryParams = computed(() => {
    const params: Record<string, string | number> = {};
    if (this.empleadoId !== null) {
      params['empleadoId'] = this.empleadoId;
    }
    if (this.fecha) {
      params['fecha'] = this.fecha;
    }
    if (this.hora) {
      params['hora'] = this.hora;
    }
    return params;
  });

  protected readonly resumenSeleccion = computed(() => {
    if (!this.fecha || !this.hora) {
      return null;
    }

    return {
      fecha: this.fechaTexto(this.fecha),
      hora: this.hora.slice(0, 5),
    };
  });

  private fechaTexto(fecha: string): string {
    const coincidencia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha.trim());
    if (!coincidencia) {
      return fecha;
    }

    const anio = Number(coincidencia[1]);
    const mes = Number(coincidencia[2]);
    const dia = Number(coincidencia[3]);
    const fechaLocal = new Date(anio, mes - 1, dia);

    if (
      fechaLocal.getFullYear() !== anio ||
      fechaLocal.getMonth() !== mes - 1 ||
      fechaLocal.getDate() !== dia
    ) {
      return fecha;
    }

    return FORMATO_FECHA_COMPLETA.format(fechaLocal);
  }

  private parseId(value: string | null): number | null {
    if (!value?.trim()) {
      return null;
    }

    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
  }
}
