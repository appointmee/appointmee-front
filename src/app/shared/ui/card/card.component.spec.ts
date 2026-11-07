import { TestBed } from '@angular/core/testing';
import { DsCardComponent } from './card.component';

describe('DsCardComponent', () => {
  it('activa una card interactiva con Enter y Espacio, sin desplazar la página', () => {
    const fixture = TestBed.createComponent(DsCardComponent);
    fixture.componentRef.setInput('interactive', true);
    fixture.detectChanges();
    const card = fixture.nativeElement.querySelector('article');
    const activated = vi.fn();
    fixture.componentInstance.activated.subscribe(activated);
    expect(card.getAttribute('role')).toBe('button');
    expect(card.tabIndex).toBe(0);
    for (const key of ['Enter', ' ']) {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      card.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
    }
    expect(activated).toHaveBeenCalledTimes(2);
  });

  it('una card informativa no agrega una parada de teclado ni acciones', () => {
    const fixture = TestBed.createComponent(DsCardComponent);
    fixture.detectChanges();
    const card = fixture.nativeElement.querySelector('article');
    const activated = vi.fn();
    fixture.componentInstance.activated.subscribe(activated);
    card.click();
    expect(card.hasAttribute('tabindex')).toBe(false);
    expect(card.hasAttribute('role')).toBe(false);
    expect(activated).not.toHaveBeenCalled();
  });
});
