import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { Registrarme } from './registrarme';
import { authService } from '../../services/auth-service';
import { MensajeResponse } from '../../models/auth';

describe('Registro de cliente', () => {
  let fixture: ComponentFixture<Registrarme>;
  let page: Registrarme;
  let respuesta: Subject<MensajeResponse>;
  const auth = { registrar: vi.fn(), login: vi.fn() };

  beforeEach(async () => {
    vi.resetAllMocks();
    respuesta = new Subject<MensajeResponse>();
    auth.registrar.mockReturnValue(respuesta);
    await TestBed.configureTestingModule({
      imports: [Registrarme],
      providers: [provideRouter([]), { provide: authService, useValue: auth }],
    }).compileComponents();
    fixture = TestBed.createComponent(Registrarme);
    page = fixture.componentInstance;
    fixture.detectChanges();
  });

  function completar() {
    page.registroModel.set({
      nombre: ' Ana ', apellido: ' Perez ',
      email: ' ANA@example.com ', confirmarEmail: 'ana@example.com',
      password: 'Clave123!', confirmarPassword: 'Clave123!',
    });
    fixture.detectChanges();
  }

  function enviar() {
    page.onSubmit(new Event('submit', { cancelable: true }));
    fixture.detectChanges();
  }

  it('valida coincidencias y contraseña antes de llamar al backend', () => {
    completar();
    page.registroModel.update(datos => ({ ...datos, confirmarEmail: 'otro@example.com' }));
    enviar();
    expect(auth.registrar).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Los emails no coinciden.');
    completar();
    page.registroModel.update(datos => ({ ...datos, confirmarPassword: 'OtraClave123!' }));
    enviar();
    expect(auth.registrar).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Las contraseñas no coinciden.');
    completar();
    page.registroModel.update(datos => ({ ...datos, password: 'sololetras', confirmarPassword: 'sololetras' }));
    enviar();
    expect(auth.registrar).not.toHaveBeenCalled();
  });

  it('envía una sola vez los cuatro campos, sin confirmaciones ni login automático', () => {
    completar();
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    enviar(); enviar();
    expect(auth.registrar).toHaveBeenCalledExactlyOnceWith({
      nombre: 'Ana', apellido: 'Perez', email: 'ana@example.com', password: 'Clave123!',
    });
    expect(fixture.nativeElement.querySelector('[type="submit"]').disabled).toBe(true);
    respuesta.next({ message: 'Creado' });
    expect(navegar).toHaveBeenCalledWith(['/login'], { state: { registroExitoso: true } });
    expect(auth.login).not.toHaveBeenCalled();
    expect(page.registroModel().password).toBe('');
  });

  it('impide pegar y arrastrar en ambas confirmaciones', () => {
    for (const id of ['confirmarEmail', 'confirmarPassword']) {
      const input = fixture.nativeElement.querySelector(`#registro-${id}`);
      for (const tipo of ['paste', 'drop']) {
        const event = new Event(tipo, { bubbles: true, cancelable: true });
        input.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(true);
      }
    }
  });

  it.each([0, 500, 503])('ante error %s conserva los datos excepto las contraseñas y permite reintentar', status => {
    completar(); enviar();
    respuesta.error({ status }); fixture.detectChanges();
    expect(page.cargando()).toBe(false);
    expect(page.registroModel().nombre).toBe('Ana');
    expect(page.registroModel().apellido).toBe('Perez');
    expect(page.registroModel().email).toBe('ana@example.com');
    expect(page.registroModel().confirmarEmail).toBe('ana@example.com');
    expect(page.registroModel().password).toBe('');
    expect(page.registroModel().confirmarPassword).toBe('');
    expect(page.mensaje()).toContain('No pudimos confirmar el registro');
    expect(fixture.nativeElement.querySelector('[type="submit"]').textContent).toContain('Reintentar');
    expect(auth.login).not.toHaveBeenCalled();
    enviar();
    expect(auth.registrar).toHaveBeenCalledTimes(1);
    const nuevoIntento = new Subject<MensajeResponse>();
    auth.registrar.mockReturnValue(nuevoIntento);
    page.registroModel.update(datos => ({ ...datos, password: 'Clave123!', confirmarPassword: 'Clave123!' }));
    enviar(); enviar();
    expect(auth.registrar).toHaveBeenCalledTimes(2);
  });

  it('ofrece login y recuperación cuando el backend confirma una cuenta pendiente', () => {
    completar(); enviar();
    respuesta.error({ status: 409, code: 'REGISTRATION_PENDING_VERIFICATION' });
    fixture.detectChanges();
    expect(page.mensaje()).toContain('pendiente de verificación');
    const acciones = fixture.nativeElement.querySelector('.registro__recuperar');
    expect(acciones.querySelector('a[href="/login"]')).not.toBeNull();
    expect(acciones.querySelector('a[href="/olvide-mi-contrasena"]')).not.toBeNull();
    expect(auth.registrar).toHaveBeenCalledTimes(1);
    expect(auth.login).not.toHaveBeenCalled();
  });
});
