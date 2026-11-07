import { ChangeDetectionStrategy, Component } from '@angular/core';
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

describe('DsInputComponent', () => {
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
