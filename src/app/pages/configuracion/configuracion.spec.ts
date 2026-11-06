import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
const estadoEnvio = (espera = 60) => ({ verificada: false, enviado: true, enviadoAhora: true, retryAfterSeconds: espera, attemptsRemaining: 5, expiresInSeconds: 300 });
import { Configuracion } from './configuracion';
import { verificacionPendienteService } from '../../services/verificacion-pendiente-service';
import { authService } from '../../services/auth-service';

describe('Ajustes · Verificar cuenta', () => {
  let fixture: ComponentFixture<Configuracion>;
  let page: Configuracion;
  const auth = { perfil: vi.fn(), autenticado: vi.fn(), solicitarVerificacion: vi.fn(), verificarEmail: vi.fn() };

  beforeEach(async () => {
    vi.resetAllMocks();
    sessionStorage.clear();
    auth.autenticado.mockReturnValue(false); auth.perfil.mockReturnValue(null);
    await TestBed.configureTestingModule({ imports: [Configuracion], providers: [
      provideRouter([]), { provide: authService, useValue: auth },
    ] }).compileComponents();
    const pendiente = TestBed.inject(verificacionPendienteService);
    pendiente.guardarEmail('ana@example.com', 'ticket-prueba');
    pendiente.aplicarEstado({ ...estadoEnvio(0), enviadoAhora: false });
    sessionStorage.setItem('verificacionPendiente', JSON.stringify({ ...pendiente.leer(), reenviarDesde: 0 }));
    fixture = TestBed.createComponent(Configuracion); page = fixture.componentInstance; fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    vi.useRealTimers();
    sessionStorage.clear();
  });

  it('muestra la pestaña dentro de Ajustes, debajo de la descripción', () => {
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('h1')?.textContent).toBe('Ajustes');
    expect(host.querySelector('.ajustes__descripcion')?.textContent).toContain('Personalizá tus preferencias');
    expect(host.querySelector('.ajustes__descripcion')?.nextElementSibling?.tagName).toBe('NAV');
    expect(host.querySelector('nav .ajustes__pestana')?.textContent).toContain('Verificar cuenta');
    expect(page.verificacionModel().email).toBe('ana@example.com');
    expect(host.textContent).not.toContain('Sección en preparación');
  });

  it('solicitar código valida solo email, no exige código todavía', () => {
    page.verificacionModel.set({ email: 'invalido', codigo: '' }); fixture.detectChanges();
    page.enviarCodigo(); expect(auth.solicitarVerificacion).not.toHaveBeenCalled();
    const response = new Subject<{ message: string }>(); auth.solicitarVerificacion.mockReturnValue(response);
    page.verificacionModel.set({ email: ' Ana@Example.com ', codigo: '' }); fixture.detectChanges();
    page.enviarCodigo(); page.enviarCodigo();
    expect(auth.solicitarVerificacion).toHaveBeenCalledTimes(1);
    expect(auth.solicitarVerificacion).toHaveBeenCalledWith('ana@example.com', true);
    response.next(estadoEnvio() as any); response.complete(); fixture.detectChanges();
    expect(page.segundosReenvio()).toBe(60);
    page.enviarCodigo(); expect(auth.solicitarVerificacion).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.textContent).toContain('Código enviado');
  });

  it('no confirma sin un código de seis dígitos', () => {
    page.verificacionModel.update(datos => ({ ...datos, codigo: '123' })); fixture.detectChanges();
    page.confirmarCodigo(new Event('submit'));
    expect(auth.verificarEmail).not.toHaveBeenCalled();
    fixture.detectChanges(); expect(fixture.nativeElement.textContent).toContain('El código debe tener 6 dígitos');
  });

  it('confirma por Enter o submit y muestra el acceso a Sucursales', () => {
    const response = new Subject<{ message: string }>(); auth.verificarEmail.mockReturnValue(response);
    page.verificacionModel.update(datos => ({ ...datos, codigo: '012345' })); fixture.detectChanges();
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    page.confirmarCodigo(new Event('submit'));
    expect(auth.verificarEmail).toHaveBeenCalledTimes(1);
    expect(auth.verificarEmail).toHaveBeenCalledWith('ana@example.com', '012345');
    response.next({ message: 'Email verificado' }); response.complete(); fixture.detectChanges();
    expect(page.verificada()).toBe(true); expect(page.verificacionModel().codigo).toBe('');
    expect(TestBed.inject(verificacionPendienteService).leer()).toBeNull();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture.nativeElement.querySelector('.verificacion__principal').click();
    expect(navigate).toHaveBeenCalledWith(['/sucursales']);
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
  });

  it.each([400, 0, 503])('muestra el error %s y permite corregir o reintentar', status => {
    const response = new Subject<{ message: string }>(); auth.verificarEmail.mockReturnValue(response);
    page.verificacionModel.update(datos => ({ ...datos, codigo: '123456' })); fixture.detectChanges();
    page.confirmarCodigo(new Event('submit')); response.error({ status }); fixture.detectChanges();
    expect(page.confirmando()).toBe(false); expect(page.verificada()).toBe(false);
    expect(page.error()).not.toBe(''); expect(fixture.nativeElement.querySelector('form')).not.toBeNull();
  });

  it('una sesión ya validada muestra cuenta verificada y no ofrece enviar códigos', () => {
    fixture.destroy();
    auth.autenticado.mockReturnValue(true); auth.perfil.mockReturnValue({ email: 'cuenta@example.com' });
    fixture = TestBed.createComponent(Configuracion); page = fixture.componentInstance; fixture.detectChanges();
    expect(page.verificacionModel().email).toBe('cuenta@example.com');
    expect(fixture.nativeElement.textContent).toContain('Tu cuenta ya está verificada');
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
    page.enviarCodigo(); expect(auth.solicitarVerificacion).not.toHaveBeenCalled();
  });

  it('pega el código completo, filtra números y no autoenvía', () => {
    const input = fixture.nativeElement.querySelector('#verificacion-codigo-0') as HTMLInputElement;
    const paste = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(paste, 'clipboardData', { value: { getData: () => '01 23-45abc' } });
    input.dispatchEvent(paste); fixture.detectChanges();
    expect(page.verificacionModel().codigo).toBe('012345');
    expect(input.value).toBe('0');
    const ultimo = fixture.nativeElement.querySelector('#verificacion-codigo-5') as HTMLInputElement;
    expect(document.activeElement).toBe(ultimo);
    expect(ultimo.selectionStart).toBe(0);
    expect(ultimo.selectionEnd).toBe(1);
    expect(Array.from(fixture.nativeElement.querySelectorAll('.verificacion__casilla') as NodeListOf<HTMLInputElement>).map(campo => campo.value).join('')).toBe('012345'); expect(auth.verificarEmail).not.toHaveBeenCalled();
    expect((fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(false);
    input.value = 'ab12x34'; input.dispatchEvent(new Event('input', { bubbles: true })); fixture.detectChanges();
    expect(page.verificacionModel().codigo).toBe('1234');
    expect((fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(true);
  });

  it('error incorrecto limpia el código, enfoca el campo y ofrece reenviar', () => {
    const response = new Subject<{ message: string }>(); auth.verificarEmail.mockReturnValue(response);
    page.verificacionModel.update(datos => ({ ...datos, codigo: '123456' })); fixture.detectChanges();
    page.confirmarCodigo(new Event('submit')); response.error({ status: 400 }); fixture.detectChanges();
    expect(page.error()).toBe('El código es incorrecto o venció');
    expect(page.verificacionModel().codigo).toBe('');
    expect(document.activeElement?.id).toBe('verificacion-codigo-0');
    expect(fixture.nativeElement.textContent).toContain('Pedir un código nuevo');
    expect(JSON.stringify(sessionStorage)).not.toContain('123456');
  });

  it('bloquea al quinto error, conserva el bloqueo al recargar y permite nuevo código tras la espera', () => {
    for (let i = 0; i < 5; i++) {
      const response = new Subject<{ message: string }>(); auth.verificarEmail.mockReturnValue(response);
      page.verificacionModel.update(datos => ({ ...datos, codigo: '123456' })); fixture.detectChanges();
      page.confirmarCodigo(new Event('submit')); response.error({ status: 400, attemptsRemaining: 4 - i, retryAfterSeconds: 60 }); fixture.detectChanges();
    }
    expect(page.bloqueada()).toBe(true);
    expect(page.segundosReenvio()).toBeGreaterThan(0);
    page.verificacionModel.update(datos => ({ ...datos, codigo: '123456' }));
    page.confirmarCodigo(new Event('submit')); expect(auth.verificarEmail).toHaveBeenCalledTimes(5);
    fixture.destroy(); fixture = TestBed.createComponent(Configuracion); page = fixture.componentInstance; fixture.detectChanges();
    expect(page.bloqueada()).toBe(true); expect(page.verificacionModel().email).toBe('ana@example.com');
    const pending = TestBed.inject(verificacionPendienteService).leer()!;
    sessionStorage.setItem('verificacionPendiente', JSON.stringify({ ...pending, reenviarDesde: 0 }));
    page.segundosReenvio.set(0);
    const response = new Subject<{ message: string }>(); auth.solicitarVerificacion.mockReturnValue(response);
    page.enviarCodigo(); response.next(estadoEnvio() as any); response.complete(); fixture.detectChanges();
    expect(page.bloqueada()).toBe(false); expect(TestBed.inject(verificacionPendienteService).leer()?.intentos).toBe(0);
  });

  it('salir cancela el contexto y nunca pone el email o el código en una URL', () => {
    page.verificacionModel.update(datos => ({ ...datos, codigo: '012345' })); fixture.detectChanges();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture.nativeElement.querySelector('.verificacion__salir').click();
    expect(navigate).toHaveBeenCalledWith(['/login']);
    expect(TestBed.inject(verificacionPendienteService).leer()).toBeNull();
    expect(page.verificacionModel().codigo).toBe('');
  });

  it('muestra seis recuadros, avanza al escribir y retrocede con Backspace', () => {
    const campos = Array.from(fixture.nativeElement.querySelectorAll('.verificacion__casilla') as NodeListOf<HTMLInputElement>);
    expect(campos).toHaveLength(6);
    expect(campos[0].getAttribute('autocomplete')).toBe('one-time-code');
    campos.forEach((campo, indice) => {
      expect(campo.getAttribute('inputmode')).toBe('numeric');
      expect(campo.getAttribute('aria-label')).toBe('Dígito ' + (indice + 1) + ' de 6');
      campo.focus(); campo.value = String(indice);
      campo.dispatchEvent(new Event('input', { bubbles: true })); fixture.detectChanges();
      expect(document.activeElement).toBe(campos[Math.min(indice + 1, 5)]);
    });
    expect(page.verificacionModel().codigo).toBe('012345');
    expect(auth.verificarEmail).not.toHaveBeenCalled();
    campos[5].dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(campos[5].value).toBe(''); expect(document.activeElement).toBe(campos[4]);
    expect(page.puedeVerificar()).toBe(false);
  });

  it('borrar un dígito intermedio no desplaza los demás recuadros', () => {
    page.verificacionModel.update(datos => ({ ...datos, codigo: '012345' })); fixture.detectChanges();
    const campos = Array.from(fixture.nativeElement.querySelectorAll('.verificacion__casilla') as NodeListOf<HTMLInputElement>);
    campos[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true })); fixture.detectChanges();
    expect(campos.map(campo => campo.value)).toEqual(['0', '1', '', '3', '4', '5']);
    expect(page.puedeVerificar()).toBe(false);
    campos[2].value = '9'; campos[2].dispatchEvent(new Event('input', { bubbles: true })); fixture.detectChanges();
    expect(page.verificacionModel().codigo).toBe('019345');
  });

  it('muestra el email enmascarado sin inputs ni atributos con el email completo', () => {
    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('Te enviamos un código de 6 dígitos');
    expect(host.textContent).toContain('an***@example.com');
    expect(host.innerHTML).not.toContain('ana@example.com');
    expect(host.querySelector('input[type="email"]')).toBeNull();
    expect(host.querySelector('#verificacion-email')).toBeNull();
  });

  it('si el email no es correcto vuelve al login y limpia el contexto', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture.nativeElement.querySelector('.verificacion__salir').click();
    expect(navigate).toHaveBeenCalledWith(['/login']);
    expect(TestBed.inject(verificacionPendienteService).leer()).toBeNull();
  });

  it('sin email pendiente no permite editar ni inventar otro desde la verificación', () => {
    fixture.destroy(); TestBed.inject(verificacionPendienteService).limpiar();
    fixture = TestBed.createComponent(Configuracion); page = fixture.componentInstance; fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
    expect(fixture.nativeElement.querySelector('input')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Volvé a iniciar sesión para continuar');
  });

  it('envía al entrar, espera 15 segundos, conserva la espera al recargar y luego aplica 60', () => {
    vi.useFakeTimers();
    fixture.destroy();
    const pendiente = TestBed.inject(verificacionPendienteService);
    pendiente.limpiar(); pendiente.guardarEmail('ana@example.com', 'ticket-prueba');
    const inicial = new Subject<{ message: string }>(); auth.solicitarVerificacion.mockReturnValue(inicial);
    fixture = TestBed.createComponent(Configuracion); page = fixture.componentInstance; fixture.detectChanges();
    expect(auth.solicitarVerificacion).toHaveBeenCalledTimes(1); expect(page.enviando()).toBe(true);
    inicial.next(estadoEnvio(15) as any); inicial.complete(); fixture.detectChanges();
    expect(page.codigoEnviado()).toBe(true); expect(page.segundosReenvio()).toBe(15);
    vi.advanceTimersByTime(5000); fixture.detectChanges(); expect(page.segundosReenvio()).toBe(10);
    fixture.destroy(); fixture = TestBed.createComponent(Configuracion); page = fixture.componentInstance; fixture.detectChanges();
    expect(auth.solicitarVerificacion).toHaveBeenCalledTimes(1); expect(page.segundosReenvio()).toBe(10);
    vi.advanceTimersByTime(10000); fixture.detectChanges(); expect(page.segundosReenvio()).toBe(0);
    const reenvio = new Subject<{ message: string }>(); auth.solicitarVerificacion.mockReturnValue(reenvio);
    page.enviarCodigo(); reenvio.next(estadoEnvio(60) as any); reenvio.complete(); fixture.detectChanges();
    expect(page.segundosReenvio()).toBe(60);
    page.enviarCodigo(); expect(auth.solicitarVerificacion).toHaveBeenCalledTimes(2);
  });

  it('muestra Todo bien y redirige a Sucursales después de dos segundos', () => {
    vi.useFakeTimers();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const response = new Subject<{ message: string }>(); auth.verificarEmail.mockReturnValue(response);
    page.verificacionModel.update(datos => ({ ...datos, codigo: '012345' })); fixture.detectChanges();
    page.confirmarCodigo(new Event('submit')); response.next({ message: 'ok' }); response.complete(); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('¡Todo bien!'); expect(navigate).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2000); expect(navigate).toHaveBeenCalledWith(['/sucursales']);
  });

  it('si el backend no reenvía, conserva el código y usa su espera sin reiniciar los intentos', () => {
    const response = new Subject<any>(); auth.solicitarVerificacion.mockReturnValue(response);
    page.verificacionModel.update(datos => ({ ...datos, codigo: '012345' })); fixture.detectChanges();
    page.enviarCodigo(); response.next({ ...estadoEnvio(47), enviadoAhora: false, attemptsRemaining: 2 }); response.complete(); fixture.detectChanges();
    expect(page.aviso()).toContain('Ya hay un código vigente');
    expect(page.aviso()).not.toContain('Código enviado');
    expect(page.segundosReenvio()).toBe(47);
    expect(page.verificacionModel().codigo).toBe('012345');
    expect(TestBed.inject(verificacionPendienteService).leer()?.intentos).toBe(3);
  });

  it('un error al enviar no confirma un envío nuevo ni cambia el plazo', () => {
    const response = new Subject<any>(); auth.solicitarVerificacion.mockReturnValue(response);
    const antes = TestBed.inject(verificacionPendienteService).leer();
    page.enviarCodigo(); response.error({ status: 503 }); fixture.detectChanges();
    expect(page.error()).toContain('No pudimos enviar');
    expect(page.aviso()).toBe('');
    expect(TestBed.inject(verificacionPendienteService).leer()).toEqual(antes);
  });

  it('muestra la vigencia real y conserva el vencimiento al recargar', () => {
    vi.useFakeTimers();
    fixture.destroy(); fixture = TestBed.createComponent(Configuracion); page = fixture.componentInstance; fixture.detectChanges();
    expect(page.tiempoVigencia()).toBe('5:00');
    expect(fixture.nativeElement.querySelector('[role="timer"]').textContent).toContain('5:00');
    expect(fixture.nativeElement.querySelector('.verificacion__sr').getAttribute('aria-live')).toBe('polite');
    vi.advanceTimersByTime(61000); fixture.detectChanges();
    expect(page.tiempoVigencia()).toBe('3:59');
    fixture.destroy(); fixture = TestBed.createComponent(Configuracion); page = fixture.componentInstance; fixture.detectChanges();
    expect(page.tiempoVigencia()).toBe('3:59');
  });

  it('al vencer anuncia el estado y no envía un código aunque esté completo', () => {
    vi.useFakeTimers();
    fixture.destroy(); fixture = TestBed.createComponent(Configuracion); page = fixture.componentInstance; fixture.detectChanges();
    vi.advanceTimersByTime(300000); fixture.detectChanges();
    page.verificacionModel.update(datos => ({ ...datos, codigo: '012345' })); fixture.detectChanges();
    expect(page.tiempoVigencia()).toBe('0:00');
    expect(page.avisoVigencia()).toContain('El código venció');
    expect(page.puedeVerificar()).toBe(false);
    page.confirmarCodigo(new Event('submit')); expect(auth.verificarEmail).not.toHaveBeenCalled();
  });

  it('deja un solo Volver al lado de Verificar, sin accesos duplicados', () => {
    const fila = fixture.nativeElement.querySelector('.verificacion__acciones-verificar');
    expect(fila.querySelector('button:first-child').classList.contains('verificacion__principal')).toBe(true);
    expect(fila.querySelector('button:last-child').textContent).toBe('Volver');
    expect(fixture.nativeElement.querySelectorAll('.verificacion__salir')).toHaveLength(1);
    expect(fixture.nativeElement.textContent).not.toContain('¿El email no es correcto?');
  });

  it('verifica automáticamente tras dos segundos completos y estables, incluso si se pegó', () => {
    vi.useFakeTimers();
    fixture.destroy(); fixture = TestBed.createComponent(Configuracion); page = fixture.componentInstance; fixture.detectChanges();
    const response = new Subject<any>(); auth.verificarEmail.mockReturnValue(response);
    const paste = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(paste, 'clipboardData', { value: { getData: () => '012345' } });
    fixture.nativeElement.querySelector('#verificacion-codigo-0').dispatchEvent(paste); fixture.detectChanges();
    vi.advanceTimersByTime(1999); fixture.detectChanges(); expect(auth.verificarEmail).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1); fixture.detectChanges(); expect(auth.verificarEmail).toHaveBeenCalledWith('ana@example.com', '012345');
    vi.advanceTimersByTime(5000); expect(auth.verificarEmail).toHaveBeenCalledTimes(1);
  });

  it('corregir reinicia la espera y un error de red no causa reintentos automáticos infinitos', () => {
    vi.useFakeTimers();
    fixture.destroy(); fixture = TestBed.createComponent(Configuracion); page = fixture.componentInstance; fixture.detectChanges();
    const response = new Subject<any>(); auth.verificarEmail.mockReturnValue(response);
    page.verificacionModel.update(datos => ({ ...datos, codigo: '012345' })); fixture.detectChanges();
    vi.advanceTimersByTime(1500);
    page.verificacionModel.update(datos => ({ ...datos, codigo: '012346' })); fixture.detectChanges();
    vi.advanceTimersByTime(1500); fixture.detectChanges(); expect(auth.verificarEmail).not.toHaveBeenCalled();
    vi.advanceTimersByTime(500); fixture.detectChanges(); expect(auth.verificarEmail).toHaveBeenCalledTimes(1);
    response.error({ status: 503 }); fixture.detectChanges();
    vi.advanceTimersByTime(10000); fixture.detectChanges(); expect(auth.verificarEmail).toHaveBeenCalledTimes(1);
  });

  it('borrar un dígito o salir cancela el autoenvío pendiente', () => {
    vi.useFakeTimers();
    fixture.destroy(); fixture = TestBed.createComponent(Configuracion); page = fixture.componentInstance; fixture.detectChanges();
    page.verificacionModel.update(datos => ({ ...datos, codigo: '012345' })); fixture.detectChanges();
    vi.advanceTimersByTime(1000);
    page.verificacionModel.update(datos => ({ ...datos, codigo: '01234' })); fixture.detectChanges();
    vi.advanceTimersByTime(3000); expect(auth.verificarEmail).not.toHaveBeenCalled();
    page.verificacionModel.update(datos => ({ ...datos, codigo: '012345' })); fixture.detectChanges();
    fixture.destroy(); vi.advanceTimersByTime(3000); expect(auth.verificarEmail).not.toHaveBeenCalled();
  });
});
