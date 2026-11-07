import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { DsButtonComponent } from './button.component';

@Component({
  imports: [DsButtonComponent],
  template: `<form (submit)="$event.preventDefault(); submits = submits + 1">
    <button dsButton class="pantalla" [class.activo]="active()" type="submit"
      [disabled]="disabled()" [attr.aria-pressed]="active()">Guardar</button>
  </form>`,
})
class ButtonHost {
  active = signal(false);
  disabled = signal(false);
  submits = 0;
}

describe('DsButtonComponent', () => {
  it('conserva clases dinámicas, atributos accesibles y submit nativo sin botones anidados', () => {
    const fixture = TestBed.createComponent(ButtonHost);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button');
    expect(fixture.nativeElement.querySelectorAll('button')).toHaveLength(1);
    expect(button.classList.contains('pantalla')).toBe(true);
    fixture.componentInstance.active.set(true);
    fixture.detectChanges();
    expect(button.classList.contains('activo')).toBe(true);
    expect(button.getAttribute('aria-pressed')).toBe('true');
    button.click();
    expect(fixture.componentInstance.submits).toBe(1);
    fixture.componentInstance.disabled.set(true);
    fixture.detectChanges();
    button.click();
    expect(fixture.componentInstance.submits).toBe(1);
  });
  it('renderiza y deshabilita cuando loading', async () => {
    await TestBed.configureTestingModule({ imports: [DsButtonComponent] }).compileComponents();
    const fixture = TestBed.createComponent(DsButtonComponent);
    fixture.componentInstance.loading = true;
    fixture.detectChanges();
    const btn = fixture.nativeElement;
    expect(btn.disabled).toBe(true);
    expect(btn.getAttribute('aria-busy')).toBe('true');
  });

  it('emite clicked al presionar', async () => {
    await TestBed.configureTestingModule({ imports: [DsButtonComponent] }).compileComponents();
    const fixture = TestBed.createComponent(DsButtonComponent);
    fixture.detectChanges();
    let clicks = 0;
    fixture.componentInstance.clicked.subscribe(() => clicks++);
    fixture.nativeElement.click();
    expect(clicks).toBe(1);
  });

  it('respeta aria-label personalizado', async () => {
    await TestBed.configureTestingModule({ imports: [DsButtonComponent] }).compileComponents();
    const fixture = TestBed.createComponent(DsButtonComponent);
    fixture.nativeElement.setAttribute('aria-label', 'Guardar cambios');
    fixture.detectChanges();
    expect(fixture.nativeElement.getAttribute('aria-label')).toBe(
      'Guardar cambios',
    );
  });

  it('aplica variantes y clases del host al botón interno', async () => {
    await TestBed.configureTestingModule({ imports: [DsButtonComponent] }).compileComponents();
    const fixture = TestBed.createComponent(DsButtonComponent);
    fixture.componentInstance.variant = 'primary';
    fixture.detectChanges();
    const btn = fixture.nativeElement;
    expect(btn.classList.contains('ds-btn--primary')).toBe(true);
    expect(btn.classList.contains('ds-btn')).toBe(true);
  });
});
