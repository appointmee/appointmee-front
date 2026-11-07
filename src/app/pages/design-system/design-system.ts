import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { DsButtonComponent } from '../../shared/ui/button/button.component';
import { DsInputComponent } from '../../shared/ui/input/input.component';
import { DsCardComponent } from '../../shared/ui/card/card.component';
import {
  DsAlertComponent,
  DsBadgeComponent,
  DsCheckboxComponent,
  DsEmptyStateComponent,
  DsModalComponent,
  DsPaginationComponent,
  DsRadioComponent,
  DsSelectComponent,
  DsSkeletonComponent,
  DsToastComponent,
} from '../../shared/ui/misc/misc.component';

@Component({
  selector: 'app-design-system',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DsButtonComponent,
    DsInputComponent,
    DsCardComponent,
    DsBadgeComponent,
    DsAlertComponent,
    DsSkeletonComponent,
    DsEmptyStateComponent,
    DsModalComponent,
    DsPaginationComponent,
    DsToastComponent,
    DsSelectComponent,
    DsCheckboxComponent,
    DsRadioComponent,
  ],
  template: `
    <main class="demo">
      <h1>Sistema de diseño</h1>
      <p>Estados base y combinaciones de contraste documentados en <code>docs/design-system.md</code>.</p>

      <section aria-labelledby="botones">
        <h2 id="botones">Botones</h2>
        <div class="fila">
          <ds-button variant="primary">Primario</ds-button>
          <ds-button>Secundario</ds-button>
          <ds-button variant="danger">Peligro</ds-button>
          <ds-button [disabled]="true">Deshabilitado</ds-button>
          <ds-button [loading]="true">Cargando</ds-button>
        </div>
      </section>

      <section aria-labelledby="inputs">
        <h2 id="inputs">Inputs</h2>
        <div class="fila">
          <ds-input label="Nombre" placeholder="Escribí tu nombre"></ds-input>
          <ds-input label="Email" type="email" error="Ingresá un email válido"></ds-input>
          <ds-input label="Deshabilitado" [disabled]="true"></ds-input>
        </div>
      </section>

      <section aria-labelledby="seleccion">
        <h2 id="seleccion">Select, checkbox y radio</h2>
        <div class="fila">
          <ds-select label="Servicio">
            <option>Consulta</option>
            <option>Kinesiología</option>
          </ds-select>
          <ds-checkbox>Acepto los términos</ds-checkbox>
          <ds-radio name="demo">Opción A</ds-radio>
          <ds-radio name="demo">Opción B</ds-radio>
        </div>
      </section>

      <section aria-labelledby="feedback">
        <h2 id="feedback">Feedback</h2>
        <div class="fila">
          <ds-badge>Default</ds-badge>
          <ds-badge variant="info">Info</ds-badge>
          <ds-badge variant="success">Éxito</ds-badge>
          <ds-badge variant="danger">Error</ds-badge>
        </div>
        <ds-alert>No se pudo completar la operación.</ds-alert>
        <ds-empty-state message="No hay turnos para mostrar"></ds-empty-state>
        <ds-skeleton width="240px" height="18px"></ds-skeleton>
        <ds-toast>Cambios guardados</ds-toast>
      </section>

      <section aria-labelledby="paginacion">
        <h2 id="paginacion">Paginación</h2>
        <ds-pagination [page]="1" [totalPages]="5"></ds-pagination>
      </section>

      <section aria-labelledby="modal">
        <h2 id="modal">Modal</h2>
        <ds-button variant="primary" (clicked)="abrirModal.set(true)">Abrir modal</ds-button>
        @if (modalAbierto()) {
          <ds-modal
            [open]="modalAbierto()"
            ariaLabelledby="demo-modal-title"
            (close)="abrirModal.set(false)"
          >
            <h3 id="demo-modal-title">Título del modal</h3>
            <p>El foco se mueve al diálogo y Escape lo cierra.</p>
            <ds-button (clicked)="abrirModal.set(false)">Cerrar</ds-button>
          </ds-modal>
        }
      </section>
    </main>
  `,
  styles: [
    `.demo{padding:var(--space-8);display:grid;gap:var(--space-6);max-width:900px;margin:0 auto}.fila{display:flex;flex-wrap:wrap;gap:var(--space-3);align-items:center;margin-bottom:var(--space-3)}h2{font-size:var(--font-size-lg)}`,
  ],
})
export class DesignSystemPage {
  readonly abrirModal = signal(false);
  readonly modalAbierto = this.abrirModal;
}
