import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, RouterOutlet, provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { Subject, of, throwError } from 'rxjs';
import { ElegirTurno } from './elegir-turno';
import { LoginPage } from '../login/login';
import { authService } from '../../services/auth-service';
import { empleadoService } from '../../services/empleado-service';
import { servicioService } from '../../services/servicio-service';
import { turnoService } from '../../services/turno-service';

@Component({ selector: 'app-turnos-test-shell', imports: [RouterOutlet], template: '<router-outlet />' })
class TestShell {}
@Component({ selector: 'app-turnos-test-page', template: '' })
class EmptyPage {}

describe('Consulta pública de horarios y login al seleccionar', () => {
  const disponibilidad = { disponibilidad: vi.fn() };
  const auth = { autenticado: signal(false), tieneAlgunRol: vi.fn(), login: vi.fn() };
  const dias = [{ fecha: '2030-12-20', horarios: ['09:00:00', '10:00:00'] }];
  let fixture: ReturnType<typeof TestBed.createComponent<TestShell>>;
  let router: Router;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    vi.resetAllMocks();
    sessionStorage.clear();
    auth.autenticado.set(false);
    auth.tieneAlgunRol.mockReturnValue(true);
    disponibilidad.disponibilidad.mockReturnValue(of(dias));
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value: function(this: HTMLDialogElement) { this.setAttribute('open', ''); },
    });
    await TestBed.configureTestingModule({
      imports: [TestShell],
      providers: [
        provideRouter([
          { path: 'sucursal/:sucursalId/servicios/:servicioId/turnos', component: ElegirTurno },
          { path: 'registrarme', component: EmptyPage },
          { path: 'login', component: EmptyPage },
        ]),
        { provide: authService, useValue: auth },
        { provide: turnoService, useValue: disponibilidad },
        { provide: servicioService, useValue: { listarPorSucursal: () => of([
          { id: 3, nombre: 'Corte', duracion: 30, nombreSucursal: 'Barber House' },
        ]) } },
        { provide: empleadoService, useValue: { listarPorSucursal: () => of([
          { id: 9, nombre: 'Ana', apellido: 'Pérez' }, { id: 10, nombre: 'Juan', apellido: 'Pérez' },
        ]) } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(TestShell);
    fixture.detectChanges();
    router = TestBed.inject(Router);
  });

  afterEach(() => fixture.destroy());

  async function abrir(query = '') {
    await router.navigateByUrl('/sucursal/7/servicios/3/turnos' + query);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('carga horarios reales sin login y abre el modal solo al tocar un horario', async () => {
    await abrir();
    expect(disponibilidad.disponibilidad).toHaveBeenCalledWith(9, 3);
    expect(fixture.nativeElement.textContent).toContain('Pantalla temporal en construcción');
    expect(fixture.nativeElement.querySelector('app-login-modal')).toBeNull();
    fixture.nativeElement.querySelector('.turnos__horarios button').click();
    fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('dialog[open]')).not.toBeNull();
    expect(router.parseUrl(router.url).queryParams).toEqual({ empleadoId: '9', fecha: '2030-12-20', hora: '09:00:00' });

    const login = fixture.debugElement.query(By.directive(LoginPage)).componentInstance as LoginPage;
    const respuesta = new Subject<void>(); auth.login.mockReturnValue(respuesta);
    login.loginModel.set({ email: 'ana@example.com', password: 'Clave123!' });
    login.onSubmit(new Event('submit', { cancelable: true }));
    auth.autenticado.set(true); respuesta.next(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-login-modal')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('todavía no se creó ningún turno');
    expect(router.url).toContain('/sucursal/7/servicios/3/turnos');
  });

  it('permite cancelar y abre el registro normal conservando el destino', async () => {
    await abrir();
    fixture.nativeElement.querySelector('.turnos__horarios button').click();
    fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
    fixture.nativeElement.querySelector('.login-modal__cerrar').click(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-login-modal')).toBeNull();
    fixture.nativeElement.querySelector('.turnos__horarios button').click();
    fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
    const registro = fixture.nativeElement.querySelector('a[href*="registrarme"]') as HTMLAnchorElement;
    expect(new URL(registro.href).searchParams.get('returnTo')).toContain('empleadoId=9');
    registro.click(); await fixture.whenStable();
    expect(router.url).toContain('/registrarme?returnTo=');
  });

  it('con sesión permite seleccionar y exige rol Cliente recién al continuar', async () => {
    auth.autenticado.set(true); auth.tieneAlgunRol.mockReturnValue(false);
    await abrir();
    fixture.nativeElement.querySelector('.turnos__horarios button').click(); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Necesitás una cuenta con rol Cliente');
    expect(fixture.nativeElement.querySelector('app-login-modal')).toBeNull();
  });

  it('restaura la selección de un enlace y permite reintentar una consulta fallida', async () => {
    await abrir('?empleadoId=10&fecha=2030-12-20&hora=10:00:00');
    expect(disponibilidad.disponibilidad).toHaveBeenCalledWith(10, 3);
    expect(fixture.nativeElement.querySelector('button[aria-pressed="true"]').textContent).toContain('10:00');
    disponibilidad.disponibilidad.mockReturnValueOnce(throwError(() => ({ status: 0 })));
    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    select.value = '9'; select.dispatchEvent(new Event('change')); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No pudimos cargar los horarios');
    const reintentar = Array.from(fixture.nativeElement.querySelectorAll('button'))
      .find(button => (button as HTMLButtonElement).textContent?.includes('Reintentar horarios')) as HTMLButtonElement;
    reintentar.click(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.turnos__horarios button').length).toBe(2);
  });

  it('US-SERV-04 · con contexto inválido limpia el contexto y ofrece volver al detalle', async () => {
    await router.navigateByUrl('/sucursal/7/servicios/999/turnos');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Este servicio no pertenece a la sucursal o ya no está disponible.',
    );
    expect(sessionStorage.getItem('appointmee.reserva-contexto.v1')).toBeNull();

    const volver = fixture.nativeElement.querySelector('a.boton') as HTMLAnchorElement;
    expect(volver?.textContent?.trim()).toBe('Volver al detalle');
  });
});
