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

  it('enlaza el GitHub de cada integrante en la vista de detalle', async () => {
    const fixture = await renderizar();
    const html = fixture.nativeElement as HTMLElement;
    const enlaces = [...html.querySelectorAll<HTMLAnchorElement>('a.creditos__github')];

    expect(enlaces).toHaveLength(2);
    expect(enlaces[0]!.getAttribute('href')).toBe('https://github.com/gonnnza');
    expect(enlaces[1]!.getAttribute('href')).toBe('https://github.com/giovannimb1');
    expect(enlaces[0]!.getAttribute('target')).toBe('_blank');
    expect(enlaces[0]!.getAttribute('rel')).toContain('noopener');
    expect(enlaces[0]!.getAttribute('aria-label')).toContain('Gonzalo Leonel López');
    expect(enlaces[0]!.textContent).toContain('Gonzalo Leonel López');
  });

  it('sin tarjeta conserva todo el contenido para integrarse en un panel', async () => {
    await TestBed.configureTestingModule({ imports: [Creditos] }).compileComponents();
    const fixture = TestBed.createComponent(Creditos);
    fixture.componentRef.setInput('tarjeta', false);
    fixture.detectChanges();
    const html = fixture.nativeElement as HTMLElement;

    expect(html.querySelector('.creditos--sin-tarjeta')).toBeTruthy();
    expect(html.textContent).toContain('Equipo de desarrollo');
    expect(html.textContent).toContain('Sobre la plataforma');
    expect(html.querySelectorAll('a.creditos__github')).toHaveLength(2);
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
