import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DsInputComponent } from './input.component';

@Component({
  standalone: true,
  imports: [DsInputComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ds-input label="Email" error="Requerido"
    ><input id="email-demo" type="email"
  /></ds-input>`,
})
class HostComponent {}

@Component({
  imports: [DsInputComponent],
  template: `<ds-input label="Nombre" [error]="error()" [loading]="loading()">
    <input aria-describedby="ayuda" />
  </ds-input><p id="ayuda">Nombre completo</p>`,
})
class DynamicHost {
  error = signal('');
  loading = signal(false);
}

describe('DsInputComponent', () => {
  it('actualiza error y carga conservando la ayuda del campo', () => {
    const fixture = TestBed.createComponent(DynamicHost);
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('input');
    fixture.componentInstance.error.set('Requerido');
    fixture.componentInstance.loading.set(true);
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    expect(input.disabled).toBe(true);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toContain('ayuda');
    expect(input.getAttribute('aria-describedby')).toContain('ds-input-error-');
    fixture.componentInstance.error.set('');
    fixture.componentInstance.loading.set(false);
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    expect(input.disabled).toBe(false);
    expect(input.hasAttribute('aria-busy')).toBe(false);
    expect(input.hasAttribute('aria-invalid')).toBe(false);
    expect(input.getAttribute('aria-describedby')).toBe('ayuda');
  });
  it('asocia label, error y aria-invalid al control proyectado', async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    const f = TestBed.createComponent(HostComponent);
    f.detectChanges();
    const input = f.nativeElement.querySelector('input');
    const error = f.nativeElement.querySelector('[role="alert"]');
    expect(f.nativeElement.querySelector('label').getAttribute('for')).toBe(input.id);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe(error.id);
    expect(f.nativeElement.querySelectorAll('input').length).toBe(1);
  });
});
