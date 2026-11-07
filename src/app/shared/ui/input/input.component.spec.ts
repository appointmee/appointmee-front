import { TestBed } from '@angular/core/testing';
import { DsInputComponent } from './input.component';

describe('DsInputComponent', () => {
  it('asocia label, error y aria-invalid', async () => {
    await TestBed.configureTestingModule({ imports: [DsInputComponent] }).compileComponents();
    const f = TestBed.createComponent(DsInputComponent);
    f.componentInstance.label = 'Email';
    f.componentInstance.error = 'Requerido';
    f.detectChanges();
    const input = f.nativeElement.querySelector('input');
    const error = f.nativeElement.querySelector('[role="alert"]');
    expect(f.nativeElement.querySelector('label').getAttribute('for')).toBe(input.id);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe(error.id);
  });
});
