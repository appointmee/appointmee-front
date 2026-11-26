import { TestBed } from '@angular/core/testing';

import { CreditosPage } from './creditos-page';

describe('CreditosPage · RF47', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('muestra los créditos y un encabezado principal accesible', async () => {
    await TestBed.configureTestingModule({ imports: [CreditosPage] }).compileComponents();
    const fixture = TestBed.createComponent(CreditosPage);
    fixture.detectChanges();
    const html = fixture.nativeElement as HTMLElement;

    expect(html.querySelector('h1')?.textContent).toContain('Créditos del sistema');
    expect(html.querySelector('[aria-labelledby="creditos-pagina-titulo"]')).toBeTruthy();
    expect(html.querySelector('app-creditos')?.textContent).toContain('Gonzalo Leonel López');
    expect(html.querySelector('app-creditos')?.textContent).toContain('Giovanni Morro Bai');
  });
});
