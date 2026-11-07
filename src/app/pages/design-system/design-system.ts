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
          <button dsButton variant="primary">Primario</button>
          <button dsButton>Secundario</button>
          <button dsButton variant="danger">Peligro</button>
          <button dsButton [disabled]="true">Deshabilitado</button>
          <button dsButton [loading]="true">Cargando</button>
          <button dsButton aria-label="Guardar cambios">Estado activo al pulsar</button>
        </div>
      </section>

      <section aria-labelledby="inputs">
        <h2 id="inputs">Inputs</h2>
        <div class="fila">
          <ds-input label="Nombre"
            ><input placeholder="Escribí tu nombre" autocomplete="name"
          /></ds-input>
          <ds-input label="Email" error="Ingresá un email válido"
            ><input type="email" autocomplete="email" aria-invalid="true"
          /></ds-input>
          <ds-input label="Deshabilitado"><input [disabled]="true" /></ds-input>
          <ds-input label="Buscando" [loading]="true" placeholder="Cargando…"></ds-input>
        </div>
      </section>

      <section aria-labelledby="seleccion">
        <h2 id="seleccion">Select, checkbox y radio</h2>
        <div class="fila">
          <ds-select label="Servicio">
            <option>Consulta</option>
            <option>Kinesiología</option>
          </ds-select>
          <ds-select label="Servicio requerido" error="Elegí una opción">
            <option value="">Seleccioná</option><option>Consulta</option>
          </ds-select>
          <ds-select label="Solo lectura" [disabled]="true"><option>Consulta</option></ds-select>
          <ds-checkbox>Acepto los términos</ds-checkbox>
          <ds-checkbox [disabled]="true">Opción deshabilitada</ds-checkbox>
          <ds-checkbox error="Confirmá esta opción">Opción con error</ds-checkbox>
          <ds-radio name="demo">Opción A</ds-radio>
          <ds-radio name="demo">Opción B</ds-radio>
          <ds-radio name="demo-disabled" [disabled]="true">Radio deshabilitado</ds-radio>
        </div>
      </section>

      <section aria-labelledby="feedback">
        <h2 id="feedback">Feedback</h2>
        <div class="fila">
          <ds-card><h3>Card base</h3><p>Contenido configurable mediante proyección.</p></ds-card>
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
        <button dsButton variant="primary" (clicked)="abrirModal.set(true)">Abrir modal</button>
        @if (modalAbierto()) {
          <ds-modal
            [open]="modalAbierto()"
            ariaLabelledby="demo-modal-title"
            (close)="abrirModal.set(false)"
          >
            <h3 id="demo-modal-title">Título del modal</h3>
            <p>El foco se mueve al diálogo y Escape lo cierra.</p>
            <button dsButton (clicked)="abrirModal.set(false)">Cerrar</button>
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
