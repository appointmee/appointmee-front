import { TestBed } from '@angular/core/testing';
import { DesignSystemPage } from './design-system';

describe('DesignSystemPage', () => {
  it('renderiza la demo y abre/cierra el modal con teclado', async () => {
    await TestBed.configureTestingModule({ imports: [DesignSystemPage] }).compileComponents();
    const f = TestBed.createComponent(DesignSystemPage);
    f.detectChanges();
    expect(f.nativeElement.querySelector('h1').textContent).toContain('Sistema de diseño');
    expect(f.nativeElement.querySelectorAll('button[dsButton]').length).toBeGreaterThan(0);

    const abrir = Array.from(
      f.nativeElement.querySelectorAll('button[dsButton]') as NodeListOf<HTMLButtonElement>,
    ).find((b) => b.textContent?.includes('Abrir modal')) as HTMLButtonElement;
    abrir.click();
    f.detectChanges();
    expect(f.nativeElement.querySelector('[role="dialog"]')).toBeTruthy();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    f.detectChanges();
    expect(f.nativeElement.querySelector('[role="dialog"]')).toBeNull();
  });
});
