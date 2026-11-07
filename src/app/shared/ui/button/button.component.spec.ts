import { TestBed } from '@angular/core/testing';
import { DsButtonComponent } from './button.component';

describe('DsButtonComponent', () => {
  it('renderiza y deshabilita cuando loading', async () => {
    await TestBed.configureTestingModule({ imports: [DsButtonComponent] }).compileComponents();
    const fixture = TestBed.createComponent(DsButtonComponent);
    fixture.componentInstance.loading = true;
    fixture.detectChanges();
    const btn = fixture.nativeElement.querySelector('button');
    expect(btn.disabled).toBe(true);
    expect(btn.getAttribute('aria-busy')).toBe('true');
  });

  it('emite clicked al presionar', async () => {
    await TestBed.configureTestingModule({ imports: [DsButtonComponent] }).compileComponents();
    const fixture = TestBed.createComponent(DsButtonComponent);
    fixture.detectChanges();
    let clicks = 0;
    fixture.componentInstance.clicked.subscribe(() => clicks++);
    fixture.nativeElement.querySelector('button').click();
    expect(clicks).toBe(1);
  });

  it('respeta aria-label personalizado', async () => {
    await TestBed.configureTestingModule({ imports: [DsButtonComponent] }).compileComponents();
    const fixture = TestBed.createComponent(DsButtonComponent);
    fixture.componentInstance.ariaLabel = 'Guardar cambios';
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('button').getAttribute('aria-label')).toBe(
      'Guardar cambios',
    );
  });

  it('aplica variantes y clases del host al botón interno', async () => {
    await TestBed.configureTestingModule({ imports: [DsButtonComponent] }).compileComponents();
    const fixture = TestBed.createComponent(DsButtonComponent);
    fixture.componentInstance.variant = 'primary';
    fixture.detectChanges();
    const btn = fixture.nativeElement.querySelector('button');
    expect(btn.classList.contains('ds-btn--primary')).toBe(true);
    expect(btn.classList.contains('ds-btn')).toBe(true);
  });
});
