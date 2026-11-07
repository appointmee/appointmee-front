import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  DsAlertComponent,
  DsBadgeComponent,
  DsCheckboxComponent,
  DsEmptyStateComponent,
  DsModalComponent,
  DsPaginationComponent,
  DsSkeletonComponent,
  DsSelectComponent,
  DsRadioComponent,
} from './misc.component';

describe('componentes de sistema de diseño', () => {
  it('select asocia el error y permite personalizar la etiqueta', async () => {
    await TestBed.configureTestingModule({ imports: [DsSelectComponent] }).compileComponents();
    const f = TestBed.createComponent(DsSelectComponent);
    f.componentInstance.label = 'Servicio';
    f.componentInstance.error = 'Elegí un servicio';
    f.detectChanges();
    const select = f.nativeElement.querySelector('select');
    expect(f.nativeElement.textContent).toContain('Servicio');
    expect(select.getAttribute('aria-invalid')).toBe('true');
    expect(f.nativeElement.querySelector('[role="alert"]').id).toBe(select.getAttribute('aria-describedby'));
  });

  it('checkbox y radio exponen el estado disabled al control nativo', async () => {
    await TestBed.configureTestingModule({ imports: [DsCheckboxComponent, DsRadioComponent] }).compileComponents();
    const checkbox = TestBed.createComponent(DsCheckboxComponent);
    const radio = TestBed.createComponent(DsRadioComponent);
    checkbox.componentInstance.disabled = true;
    radio.componentInstance.disabled = true;
    checkbox.detectChanges();
    radio.detectChanges();
    expect(checkbox.nativeElement.querySelector('input').disabled).toBe(true);
    expect(radio.nativeElement.querySelector('input').disabled).toBe(true);
  });

  it('radio asocia el error con aria-describedby', async () => {
    await TestBed.configureTestingModule({ imports: [DsRadioComponent] }).compileComponents();
    const f = TestBed.createComponent(DsRadioComponent);
    f.componentInstance.error = 'Elegí una opción';
    f.detectChanges();
    const radio = f.nativeElement.querySelector('input');
    expect(radio.getAttribute('aria-invalid')).toBe('true');
    expect(radio.getAttribute('aria-describedby')).toBe(f.nativeElement.querySelector('[role="alert"]').id);
  });

  it('badge aplica variante success', async () => {
    await TestBed.configureTestingModule({ imports: [DsBadgeComponent] }).compileComponents();
    const f = TestBed.createComponent(DsBadgeComponent);
    f.componentInstance.variant = 'success';
    f.detectChanges();
    expect(f.nativeElement.querySelector('.ds-badge--success')).toBeTruthy();
  });

  it('alert usa role alert y aria-live', async () => {
    await TestBed.configureTestingModule({ imports: [DsAlertComponent] }).compileComponents();
    const f = TestBed.createComponent(DsAlertComponent);
    f.detectChanges();
    const alert = f.nativeElement.querySelector('[role="alert"]');
    expect(alert).toBeTruthy();
    expect(alert.getAttribute('aria-live')).toBe('assertive');
  });

  it('skeleton es decorativo', async () => {
    await TestBed.configureTestingModule({ imports: [DsSkeletonComponent] }).compileComponents();
    const f = TestBed.createComponent(DsSkeletonComponent);
    f.detectChanges();
    expect(f.nativeElement.querySelector('[aria-hidden="true"]')).toBeTruthy();
  });

  it('empty state anuncia el estado', async () => {
    await TestBed.configureTestingModule({ imports: [DsEmptyStateComponent] }).compileComponents();
    const f = TestBed.createComponent(DsEmptyStateComponent);
    f.detectChanges();
    expect(f.nativeElement.querySelector('[role="status"]')).toBeTruthy();
  });

  it('paginación deshabilita anterior en primera página y emite cambios', async () => {
    await TestBed.configureTestingModule({ imports: [DsPaginationComponent] }).compileComponents();
    const f = TestBed.createComponent(DsPaginationComponent);
    f.componentInstance.totalPages = 3;
    f.detectChanges();
    const buttons = f.nativeElement.querySelectorAll('button');
    expect(buttons[0].disabled).toBe(true);
    buttons[1].click();
    f.detectChanges();
    expect(f.componentInstance.page).toBe(2);
    expect(f.nativeElement.querySelector('[aria-live="polite"]').textContent).toContain('Página 2');
  });

  it('modal no renderiza si está cerrado', async () => {
    await TestBed.configureTestingModule({ imports: [DsModalComponent] }).compileComponents();
    const f = TestBed.createComponent(DsModalComponent);
    f.detectChanges();
    expect(f.nativeElement.querySelector('[role="dialog"]')).toBeNull();
  });

  it('modal abierto tiene rol dialog, aria-modal y enfoca el diálogo', async () => {
    await TestBed.configureTestingModule({ imports: [DsModalComponent] }).compileComponents();
    const f = TestBed.createComponent(DsModalComponent);
    f.componentInstance.open = true;
    f.componentInstance.ariaLabel = 'Confirmar';
    f.detectChanges();
    f.detectChanges();
    const dialog = f.nativeElement.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-label')).toBe('Confirmar');
    expect(document.activeElement).toBe(dialog);
  });

  it('modal emite close con Escape', async () => {
    await TestBed.configureTestingModule({ imports: [DsModalComponent] }).compileComponents();
    const f = TestBed.createComponent(DsModalComponent);
    f.componentInstance.open = true;
    f.detectChanges();
    let cerrado = false;
    f.componentInstance.close.subscribe(() => (cerrado = true));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(cerrado).toBe(true);
  });

  it('modal devuelve el foco al elemento que lo abrió', async () => {
    await TestBed.configureTestingModule({ imports: [DsModalComponent] }).compileComponents();
    const opener = document.createElement('button');
    document.body.append(opener);
    opener.focus();
    const f = TestBed.createComponent(DsModalComponent);
    f.componentInstance.open = true;
    f.detectChanges();
    f.detectChanges();
    f.componentInstance.open = false;
    f.detectChanges();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it('modal mantiene Tab dentro del diálogo en ambos sentidos', async () => {
    @Component({
      standalone: true,
      imports: [DsModalComponent],
      template: `<ds-modal [open]="true"><button id="primero">Primero</button><button id="ultimo">Último</button></ds-modal>`,
    })
    class ModalHost {}
    await TestBed.configureTestingModule({ imports: [ModalHost] }).compileComponents();
    const f = TestBed.createComponent(ModalHost);
    f.detectChanges();
    const first = f.nativeElement.querySelector('#primero') as HTMLButtonElement;
    const last = f.nativeElement.querySelector('#ultimo') as HTMLButtonElement;
    last.focus();
    last.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(document.activeElement).toBe(first);
    first.focus();
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }));
    expect(document.activeElement).toBe(last);
  });
});
