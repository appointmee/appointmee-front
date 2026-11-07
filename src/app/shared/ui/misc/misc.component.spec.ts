import { TestBed } from '@angular/core/testing';
import {
  DsAlertComponent,
  DsBadgeComponent,
  DsEmptyStateComponent,
  DsModalComponent,
  DsPaginationComponent,
  DsSkeletonComponent,
} from './misc.component';

describe('componentes de sistema de diseño', () => {
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
});
