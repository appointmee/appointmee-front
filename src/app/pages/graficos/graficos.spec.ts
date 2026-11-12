import { Directive, Input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, provideRouter } from '@angular/router';
import type { EChartsOption } from 'echarts';
import { of } from 'rxjs';

import type { AdminEstadisticas, EmpleadorEstadisticas } from '../../models/estadisticas';
import { estadisticasService } from '../../services/estadisticas-service';
import { sucursalService } from '../../services/sucursal-service';
import { Graficos } from './graficos';
import { NgxEchartsDirective } from 'ngx-echarts';

@Directive({ selector: '[echarts]', standalone: true })
class EchartsStubDirective {
  @Input() options: EChartsOption = {};
  @Input() autoResize = true;
}

const ADMIN_DATOS: AdminEstadisticas = {
  desde: '2026-11-01', hasta: '2026-11-02', agrupacion: 'DIA',
  turnosPorPeriodo: [{ periodo: '2026-11-01', estados: { PENDIENTE: 1, CONFIRMADO: 2, REALIZADO: 3, CANCELADO: 0, PAGO_RECHAZADO: 0 } }],
  usuarios: {
    nuevosPorPeriodo: [{ periodo: '2026-11-01', altasPorRol: { CLIENTE: 2, EMPLEADOR: 1, EMPLEADO: 0 } }],
    activosActualesPorRol: { CLIENTE: 12, EMPLEADOR: 3, EMPLEADO: 4 },
  },
  sucursales: { nuevasPorPeriodo: [{ periodo: '2026-11-01', nuevas: 2 }], activasActualmente: 5, inactivasActualmente: 1 },
};

const EMPLEADOR_DATOS: EmpleadorEstadisticas = {
  desde: '2026-11-01', hasta: '2026-11-02', agrupacion: 'DIA',
  turnosPorPeriodo: ADMIN_DATOS.turnosPorPeriodo,
  demandaPorServicio: [{ servicioId: 7, servicio: 'Corte', cantidad: 5 }],
  cancelaciones: {
    cantidad: 1, turnosConcluidos: 4, tasa: 25,
    porPeriodo: [{ periodo: '2026-11-01', cancelados: 1, turnosConcluidos: 4, tasa: 25 }],
  },
  ocupacion: { disponible: false, motivo: 'No disponible' },
  ingresos: { disponible: false, motivo: 'No disponible' },
  ausencias: { disponible: false, motivo: 'No disponible' },
};

describe('Gráficos ECharts', () => {
  let admin: ReturnType<typeof vi.fn>;
  let empleador: ReturnType<typeof vi.fn>;
  let fixture: ComponentFixture<Graficos>;

  async function abrir(rolGrafico: 'administrador' | 'empleador'): Promise<void> {
    TestBed.configureTestingModule({
      imports: [Graficos],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { data: { rolGrafico } } } },
        { provide: estadisticasService, useValue: { administrador: admin, empleador } },
        { provide: sucursalService, useValue: { listarPropias: () => of([{ id: 9, nombre: 'Sucursal', categoria: 'BARBERIA', fotoPerfil: null, puntuacion: 0, cantidadPuntuaciones: 0 }]) } },
      ],
    });
    TestBed.overrideComponent(Graficos, {
      remove: { imports: [NgxEchartsDirective] },
      add: { imports: [EchartsStubDirective] },
    });
    await TestBed.compileComponents();
    fixture = TestBed.createComponent(Graficos);
    fixture.detectChanges();
  }

  beforeEach(() => {
    admin = vi.fn(() => of(ADMIN_DATOS));
    empleador = vi.fn(() => of(EMPLEADOR_DATOS));
  });

  it('renderiza gráficos administrativos con series y tablas accesibles', async () => {
    await abrir('administrador');

    const opciones = fixture.debugElement.queryAll(By.directive(EchartsStubDirective))
      .map((nodo) => nodo.injector.get(EchartsStubDirective).options);

    expect(opciones).toHaveLength(3);
    expect(opciones[0].series).toHaveLength(5);
    expect(opciones[1].series).toHaveLength(3);
    expect(fixture.nativeElement.querySelectorAll('table').length).toBeGreaterThanOrEqual(2);
    expect(fixture.nativeElement.querySelectorAll('[role="img"]').length).toBe(3);
  });

  it('renderiza gráficos de turnos, demanda y cancelaciones para el empleador', async () => {
    await abrir('empleador');

    const opciones = fixture.debugElement.queryAll(By.directive(EchartsStubDirective))
      .map((nodo) => nodo.injector.get(EchartsStubDirective).options);

    expect(opciones).toHaveLength(3);
    expect((opciones[1].series as { name: string }[])[0].name).toBe('Turnos');
    expect((opciones[2].series as { name: string }[])[0].name).toBe('Tasa de cancelación');
    expect(fixture.nativeElement.textContent).toContain('Demanda por servicio');
  });
});
