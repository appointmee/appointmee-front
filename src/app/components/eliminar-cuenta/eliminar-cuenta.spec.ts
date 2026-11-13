import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { EliminarCuenta } from './eliminar-cuenta';
import { authService } from '../../services/auth-service';
import { backendService } from '../../services/backend-service';

@Component({ template: '' })
class TestPage {}

/**
 * Estilos que Angular registra en el documento al renderizar el componente.
 * Se usan para verificar reglas de CSS que jsdom no aplica.
 */
function estilosRegistrados(): string {
  return Array.from(document.querySelectorAll('style'))
    .map((style) => style.textContent ?? '')
    .join('\n');
}

describe('SCRUM-274 · Eliminar cuenta desde Ajustes', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<EliminarCuenta>>;
  let backend: HttpTestingController;
  let router: Router;
  let auth: authService;
  let baseUrl: string;

  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [EliminarCuenta],
      providers: [
        provideRouter([{ path: '', component: TestPage }]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    backend = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    auth = TestBed.inject(authService);
    baseUrl = TestBed.inject(backendService).baseUrl;

    fixture = TestBed.createComponent(EliminarCuenta);
  });

  afterEach(() => {
    fixture.destroy();
    backend.verify();
    localStorage.clear();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  /** Deja al usuario con una sesión activa, como en Ajustes. */
  function iniciarSesion(): void {
    auth.login('ana@example.com', 'Password123!').subscribe();
    backend
      .expectOne(`${baseUrl}/auth/login`)
      .flush({ token: 'access', refreshToken: 'refresh', expiresIn: 900 });
    backend
      .expectOne(`${baseUrl}/usuarios/me`)
      .flush({ id: 1, roles: ['CLIENTE'], fotoPerfil: null });
    fixture.detectChanges();
  }

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function texto(): string {
    return (host().textContent ?? '').replace(/\u00a0/g, ' ');
  }

  /** Diálogo de confirmación visible (de los dos que hay). */
  function dialogo(): HTMLElement | null {
    return host().querySelector<HTMLElement>('ds-modal .ds-modal');
  }

  function botonesDelDialogo(): HTMLButtonElement[] {
    return Array.from(dialogo()?.querySelectorAll<HTMLButtonElement>('button') ?? []);
  }

  function botonPorTexto(textoBoton: string): HTMLButtonElement | null {
    return botonesDelDialogo().find((boton) => boton.textContent?.trim().startsWith(textoBoton)) ?? null;
  }

  function botonEliminar(): HTMLButtonElement {
    return host().querySelector<HTMLButtonElement>('button.eliminar-cuenta__boton')!;
  }

  it('muestra el título, el aviso y el botón con el diseño de las demás secciones', () => {
    iniciarSesion();

    const seccion = host().querySelector<HTMLElement>('section.eliminar-cuenta');
    expect(seccion).toBeTruthy();
    expect(seccion?.getAttribute('aria-labelledby')).toBe('eliminar-cuenta-titulo');
    expect(seccion?.querySelector('h2')?.textContent?.trim()).toBe('Eliminar cuenta');

    // El aviso va dentro de un recuadro con el mismo diseño de los avisos de Ajustes.
    const aviso = seccion?.querySelector<HTMLElement>('.eliminar-cuenta__aviso');
    expect(aviso?.textContent).toContain('AVISO:');
    expect(aviso?.textContent).toContain(
      'Una vez una cuenta es eliminada, un administrador puede reactivarla, pero no es un proceso garantizado y llevará mucho tiempo',
    );

    // El botón va debajo del aviso.
    expect(botonEliminar().textContent?.trim()).toBe('Eliminar cuenta');
    expect(aviso?.compareDocumentPosition(botonEliminar())).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('replica el botón rojo de "Cancelar turno" y "Eliminar empleado"', () => {
    iniciarSesion();

    const css = estilosRegistrados();

    expect(css).toMatch(/\.eliminar-cuenta__boton[^{]*\{[^}]*background:\s*rgba\(255, 122, 122, 0\.16\)/);
    expect(css).toMatch(/\.eliminar-cuenta__boton[^{]*\{[^}]*color:\s*#ffb0b0/);
    expect(css).toMatch(
      /\.eliminar-cuenta__boton[^{]*\{[^}]*border-color:\s*rgba\(255, 122, 122, 0\.32\)/,
    );
    expect(css).toMatch(
      /\.eliminar-cuenta__boton[^{]*:hover:not\(:disabled\)[^{]*\{[^}]*background:\s*rgba\(255, 122, 122, 0\.26\)/,
    );
    expect(css).toMatch(/\.eliminar-cuenta__boton[^{]*:disabled[^{]*\{[^}]*opacity:\s*0\.45/);

    // Usa el botón del sistema de diseño, igual que las acciones destructivas.
    expect(botonEliminar().classList.contains('ds-btn')).toBe(true);
  });

  it('pide la primera confirmación sin tocar el backend', () => {
    iniciarSesion();

    botonEliminar().click();
    fixture.detectChanges();

    expect(dialogo()?.textContent).toContain('¿Estás seguro de eliminar la cuenta?');
    backend.expectNone((request) => request.method === 'DELETE');
  });

  it('no realiza ninguna acción cuando se cancela la primera confirmación', () => {
    iniciarSesion();

    botonEliminar().click();
    fixture.detectChanges();
    botonPorTexto('Cancelar')?.click();
    fixture.detectChanges();

    expect(dialogo()).toBeNull();
    backend.expectNone((request) => request.method === 'DELETE');
  });

  it('pide una segunda confirmación independiente antes de eliminar', () => {
    iniciarSesion();

    botonEliminar().click();
    fixture.detectChanges();
    botonPorTexto('Sí, eliminar')?.click();
    fixture.detectChanges();

    expect(dialogo()?.textContent).toContain(
      'Este puede ser un procedimiento permanente, ¿estás seguro de continuar?',
    );
    // El endpoint todavía no se invoca: falta la segunda confirmación.
    backend.expectNone((request) => request.method === 'DELETE');
  });

  it('no realiza ninguna acción cuando se cancela la segunda confirmación', () => {
    iniciarSesion();

    botonEliminar().click();
    fixture.detectChanges();
    botonPorTexto('Sí, eliminar')?.click();
    fixture.detectChanges();
    botonPorTexto('Cancelar')?.click();
    fixture.detectChanges();

    expect(dialogo()).toBeNull();
    backend.expectNone((request) => request.method === 'DELETE');
  });

  it('elimina la cuenta con el endpoint existente solo después de las dos confirmaciones', () => {
    iniciarSesion();

    botonEliminar().click();
    fixture.detectChanges();
    botonPorTexto('Sí, eliminar')?.click();
    fixture.detectChanges();
    botonPorTexto('Sí, continuar')?.click();
    fixture.detectChanges();

    const peticion = backend.expectOne(
      (request) =>
        request.method === 'DELETE' && request.url === `${baseUrl}/usuarios/borrar-cuenta`,
    );
    peticion.flush('Se eliminó la cuenta');
  });

  it('cierra la sesión, avisa el resultado y vuelve al Home sin sesión', () => {
    vi.useFakeTimers();
    iniciarSesion();

    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    botonEliminar().click();
    fixture.detectChanges();
    botonPorTexto('Sí, eliminar')?.click();
    fixture.detectChanges();
    botonPorTexto('Sí, continuar')?.click();
    fixture.detectChanges();

    backend
      .expectOne(
        (request) =>
          request.method === 'DELETE' && request.url === `${baseUrl}/usuarios/borrar-cuenta`,
      )
      .flush('Se eliminó la cuenta');
    fixture.detectChanges();

    // El feedback inline de éxito se muestra antes de salir de la pantalla.
    const exito = host().querySelector<HTMLElement>('.eliminar-cuenta__exito');
    expect(exito?.textContent).toContain('Tu cuenta fue eliminada correctamente');
    expect(exito?.getAttribute('role')).toBe('status');

    // La sesión local queda limpia con el mecanismo existente.
    expect(auth.autenticado()).toBe(false);
    expect(auth.visitante()).toBe(true);
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('refreshToken')).toBeNull();
    expect(localStorage.getItem('email')).toBeNull();

    // Y el usuario vuelve al Home.
    vi.advanceTimersByTime(2000);
    expect(navigate).toHaveBeenCalledWith(['/'], { replaceUrl: true });
  });

  it('no cierra la sesión ni redirige cuando la eliminación falla', () => {
    iniciarSesion();

    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    botonEliminar().click();
    fixture.detectChanges();
    botonPorTexto('Sí, eliminar')?.click();
    fixture.detectChanges();
    botonPorTexto('Sí, continuar')?.click();
    fixture.detectChanges();

    backend
      .expectOne(
        (request) =>
          request.method === 'DELETE' && request.url === `${baseUrl}/usuarios/borrar-cuenta`,
      )
      .flush('Error', { status: 500, statusText: 'Error' });
    fixture.detectChanges();

    const error = host().querySelector<HTMLElement>('.eliminar-cuenta__error');
    expect(error?.textContent).toContain('No pudimos eliminar la cuenta');
    expect(error?.getAttribute('role')).toBe('alert');

    // La sesión sigue vigente y el usuario permanece en Ajustes.
    expect(auth.autenticado()).toBe(true);
    expect(localStorage.getItem('token')).not.toBeNull();
    expect(navigate).not.toHaveBeenCalled();
    expect(host().querySelector<HTMLElement>('.eliminar-cuenta__exito')).toBeNull();
  });

  it('no dispara eliminaciones simultáneas con doble clic', () => {
    iniciarSesion();

    botonEliminar().click();
    fixture.detectChanges();
    botonPorTexto('Sí, eliminar')?.click();
    fixture.detectChanges();

    const confirmar = botonPorTexto('Sí, continuar');
    confirmar?.click();
    fixture.detectChanges();
    confirmar?.click();
    fixture.detectChanges();

    const peticiones = backend.match(
      (request) =>
        request.method === 'DELETE' && request.url === `${baseUrl}/usuarios/borrar-cuenta`,
    );
    expect(peticiones.length).toBe(1);

    peticiones[0].flush('Se eliminó la cuenta');
  });

  it('informa los errores de red sin cerrar la sesión', () => {
    iniciarSesion();

    botonEliminar().click();
    fixture.detectChanges();
    botonPorTexto('Sí, eliminar')?.click();
    fixture.detectChanges();
    botonPorTexto('Sí, continuar')?.click();
    fixture.detectChanges();

    backend
      .expectOne(
        (request) =>
          request.method === 'DELETE' && request.url === `${baseUrl}/usuarios/borrar-cuenta`,
      )
      .error(new ProgressEvent('error'));
    fixture.detectChanges();

    expect(host().querySelector<HTMLElement>('.eliminar-cuenta__error')?.textContent).toContain(
      'No pudimos conectar con el servidor',
    );
    expect(auth.autenticado()).toBe(true);
  });
});
