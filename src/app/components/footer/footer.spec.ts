import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { authService } from '../../services/auth-service';
import { Footer } from './footer';

describe('Footer', () => {
  let fixture: ComponentFixture<Footer>;
  let visitante: ReturnType<typeof signal<boolean>>;
  let autenticado: ReturnType<typeof signal<boolean>>;

  beforeEach(() => {
    visitante = signal(true);
    autenticado = signal(false);

    TestBed.configureTestingModule({
      imports: [Footer],
      providers: [
        provideRouter([]),
        {
          provide: authService,
          useValue: { visitante, autenticado },
        },
      ],
    });

    fixture = TestBed.createComponent(Footer);
    fixture.detectChanges();
  });

  const links = (): string[] =>
    [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLAnchorElement>('a')].map(
      (link) => link.getAttribute('href') ?? '',
    );

  it('muestra marca, descripción, navegación y el año actual', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('footer')).toBeTruthy();
    expect(element.querySelector('img')?.getAttribute('src')).toBe('appointmee-logo.png');
    expect(element.textContent).toContain('Conectamos clientes con establecimientos');
    expect(element.textContent).toContain(new Date().getFullYear().toString());
    expect(links()).toEqual(
      expect.arrayContaining(['/', '/sucursales', '/#quienes-somos', '/#como-funciona']),
    );
    expect(element.textContent).toContain('Información');
  });

  it('muestra accesos de visitante', () => {
    expect(links()).toEqual(expect.arrayContaining(['/login', '/registrarme']));
    expect(links()).not.toEqual(expect.arrayContaining(['/perfil', '/configuracion']));
  });

  it('muestra perfil y configuración para usuarios autenticados', () => {
    visitante.set(false);
    autenticado.set(true);
    fixture.detectChanges();

    expect(links()).toEqual(expect.arrayContaining(['/perfil', '/configuracion']));
    expect(links()).not.toEqual(expect.arrayContaining(['/login', '/registrarme']));
  });

  it('no anticipa accesos mientras restaura la sesión', () => {
    visitante.set(false);
    autenticado.set(false);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="status"]')?.textContent).toContain(
      'Restaurando sesión',
    );
    expect(links()).not.toEqual(
      expect.arrayContaining(['/login', '/registrarme', '/perfil', '/configuracion']),
    );
  });
});
