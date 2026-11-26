import { TestBed } from '@angular/core/testing';

import { Creditos } from './creditos';

describe('Creditos · RF47', () => {
  async function renderizar(nivel: 2 | 3 = 2) {
    await TestBed.configureTestingModule({ imports: [Creditos] }).compileComponents();
    const fixture = TestBed.createComponent(Creditos);
    fixture.componentRef.setInput('nivel', nivel);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => TestBed.resetTestingModule());

  it('muestra los dos integrantes y la información de la plataforma', async () => {
    const fixture = await renderizar();
    const html = fixture.nativeElement as HTMLElement;

    expect(html.textContent).toContain('Gonzalo Leonel López');
    expect(html.textContent).toContain('Giovanni Morro Bai');
    expect(html.textContent).toContain('Equipo de desarrollo');
    expect(html.textContent).toContain('Sobre la plataforma');
    expect(html.textContent).toContain('gestionar turnos');
  });

  it('usa marcado semántico: sección con nombre, lista de integrantes y encabezado configurable', async () => {
    const fixture = await renderizar();
    const html = fixture.nativeElement as HTMLElement;

    expect(html.querySelector('section')?.getAttribute('aria-label')).toBe('Créditos del sistema');
    expect(html.querySelector('h2')?.textContent).toContain('Créditos del sistema');
    expect(html.querySelector('h3')).toBeNull();

    const items = html.querySelectorAll('ul.creditos__lista > li');
    expect(items).toHaveLength(2);
    expect(items[0]!.textContent).toContain('Gonzalo Leonel López');
    expect(items[1]!.textContent).toContain('Giovanni Morro Bai');
  });

  it('baja un nivel el encabezado al insertarse dentro de otra sección', async () => {
    const fixture = await renderizar(3);
    const html = fixture.nativeElement as HTMLElement;

    expect(html.querySelector('h2')).toBeNull();
    expect(html.querySelector('h3')?.textContent).toContain('Créditos del sistema');
  });

  it('permite personalizar el título visible', async () => {
    await TestBed.configureTestingModule({ imports: [Creditos] }).compileComponents();
    const fixture = TestBed.createComponent(Creditos);
    fixture.componentRef.setInput('titulo', 'Equipo e información');
    fixture.detectChanges();
    const html = fixture.nativeElement as HTMLElement;

    expect(html.querySelector('section')?.getAttribute('aria-label')).toBe('Equipo e información');
    expect(html.querySelector('h2')?.textContent).toContain('Equipo e información');
  });
});
