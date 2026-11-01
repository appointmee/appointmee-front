import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { verificacionPendienteService } from '../services/verificacion-pendiente-service';
import { authService } from '../services/auth-service';
import { backendService } from '../services/backend-service';
import { apiErrorInterceptor } from '../http/api-errors-service';
import { authInterceptor } from './auth-interceptor';

@Component({ template: '' })
class TestPage {}

describe('Autenticación e interceptor', () => {
  let API_URL: string;
  let http: HttpClient;
  let backend: HttpTestingController;
  let auth: authService;
  let router: Router;
  const perfil = { id: 1, roles: ['CLIENTE'], fotoPerfil: null };
  const tokens = { token: 'access-nuevo', refreshToken: 'refresh-nuevo', expiresIn: 900 };
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'login', component: TestPage },
          { path: 'private', component: TestPage },
        ]),
        provideHttpClient(withInterceptors([apiErrorInterceptor, authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    API_URL = TestBed.inject(backendService).baseUrl;
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(authService);
    router = TestBed.inject(Router);
  });
  afterEach(() => {
    backend.verify();
    localStorage.clear();
  });
  function sesion() {
    localStorage.setItem('token', 'access-viejo');
    localStorage.setItem('refreshToken', 'refresh-viejo');
  }
  function rechazar(url: string) {
    backend.expectOne(url).flush({}, { status: 401, statusText: 'Unauthorized' });
  }

  it('login usa el contrato real, guarda ambos tokens y carga el perfil', () => {
    auth.login('ana@example.com', 'Password123!').subscribe();
    const login = backend.expectOne(`${API_URL}/auth/login`);
    expect(login.request.body).toEqual({ email: 'ana@example.com', pass: 'Password123!' });
    expect(login.request.headers.has('Authorization')).toBe(false);
    login.flush(tokens);
    const me = backend.expectOne(`${API_URL}/usuarios/me`);
    expect(me.request.headers.get('Authorization')).toBe('Bearer access-nuevo');
    me.flush(perfil);
    expect(auth.autenticado()).toBe(true);
    expect(auth.tieneAlgunRol('CLIENTE')).toBe(true);
    expect(auth.perfil()?.email).toBe('ana@example.com');
    expect(localStorage.getItem('refreshToken')).toBe('refresh-nuevo');
  });
  it('no envía tokens a terceros ni a endpoints públicos', () => {
    sesion();
    for (const url of [
      'https://example.com/data',
      `${API_URL}.example.com/data`,
      `${API_URL}/auth/login`,
    ]) {
      http.get(url).subscribe();
      const request = backend.expectOne(url);
      expect(request.request.headers.has('Authorization')).toBe(false);
      request.flush({});
    }
  });
  it('dos respuestas 401 comparten un solo refresh y reintentan con el nuevo access', () => {
    sesion();
    http.get(`${API_URL}/uno`).subscribe();
    http.get(`${API_URL}/dos`).subscribe();
    rechazar(`${API_URL}/uno`);
    rechazar(`${API_URL}/dos`);
    const refresh = backend.expectOne(`${API_URL}/auth/refresh`);
    expect(refresh.request.body).toEqual({ refreshToken: 'refresh-viejo' });
    expect(refresh.request.headers.has('Authorization')).toBe(false);
    refresh.flush(tokens);
    for (const url of ['/uno', '/dos']) {
      const retry = backend.expectOne(API_URL + url);
      expect(retry.request.headers.get('Authorization')).toBe('Bearer access-nuevo');
      retry.flush({});
    }
    expect(localStorage.getItem('refreshToken')).toBe('refresh-nuevo');
  });
  it('un 401 tardío usa el access ya renovado sin rotar de nuevo', () => {
    sesion();
    http.get(`${API_URL}/uno`).subscribe();
    http.get(`${API_URL}/dos`).subscribe();
    const uno = backend.expectOne(`${API_URL}/uno`);
    const dos = backend.expectOne(`${API_URL}/dos`);
    uno.flush({}, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne(`${API_URL}/auth/refresh`).flush(tokens);
    backend.expectOne(`${API_URL}/uno`).flush({});
    dos.flush({}, { status: 401, statusText: 'Unauthorized' });
    backend.expectNone(`${API_URL}/auth/refresh`);
    const retry = backend.expectOne(`${API_URL}/dos`);
    expect(retry.request.headers.get('Authorization')).toBe('Bearer access-nuevo');
    retry.flush({});
  });
  it('refresh rechazado limpia la sesión y conserva returnTo', async () => {
    sesion();
    await router.navigateByUrl('/private?tab=history');
    http.get(`${API_URL}/privado`).subscribe({ error: () => undefined });
    rechazar(`${API_URL}/privado`);
    rechazar(`${API_URL}/auth/refresh`);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('refreshToken')).toBeNull();
    expect(router.url).toContain('/login?');
    expect(router.url).toContain('returnTo=%2Fprivate%3Ftab%3Dhistory');
  });
  it('un fallo de red del refresh conserva las credenciales', () => {
    sesion();
    http.get(`${API_URL}/privado`).subscribe({ error: () => undefined });
    rechazar(`${API_URL}/privado`);
    backend.expectOne(`${API_URL}/auth/refresh`).error(new ProgressEvent('error'));
    expect(localStorage.getItem('refreshToken')).toBe('refresh-viejo');
    expect(localStorage.getItem('token')).toBe('access-viejo');
  });
  it('restaura desde refresh cuando falta el access', () => {
    localStorage.setItem('refreshToken', 'refresh-viejo');
    auth.inicializar().subscribe();
    expect(auth.restaurando()).toBe(true);
    backend.expectOne(`${API_URL}/auth/refresh`).flush(tokens);
    backend.expectOne(`${API_URL}/usuarios/me`).flush(perfil);
    expect(auth.autenticado()).toBe(true);
  });
  it('logout llama al servidor y limpia la sesión', () => {
    sesion();
    auth.logout().subscribe();
    const logout = backend.expectOne(`${API_URL}/auth/logout`);
    expect(logout.request.headers.get('Authorization')).toBe('Bearer access-viejo');
    logout.flush({});
    expect(auth.visitante()).toBe(true);
    expect(localStorage.getItem('refreshToken')).toBeNull();
  });
  it('logout con access vencido renueva antes de revocar en el servidor', () => {
    sesion();
    auth.logout().subscribe();
    rechazar(`${API_URL}/auth/logout`);
    backend.expectOne(`${API_URL}/auth/refresh`).flush(tokens);
    const logout = backend.expectOne(`${API_URL}/auth/logout`);
    expect(logout.request.headers.get('Authorization')).toBe('Bearer access-nuevo');
    logout.flush({});
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('refreshToken')).toBeNull();
  });
  it('un perfil tardío no revive una sesión cerrada', () => {
    sesion();
    auth.validarToken().subscribe({ error: () => undefined });
    const me = backend.expectOne(`${API_URL}/usuarios/me`);
    auth.limpiarSesion();
    me.flush(perfil);
    expect(auth.autenticado()).toBe(false);
  });
  it('una petición anónima no intenta refresh ni fuerza navegación', () => {
    http.get(`${API_URL}/publico`).subscribe({ error: () => undefined });
    rechazar(`${API_URL}/publico`);
    backend.expectNone(`${API_URL}/auth/refresh`);
    expect(router.url).toBe('/');
  });
  it('los métodos de verificación son públicos y usan el contrato del backend', () => {
    sesion();
    TestBed.inject(verificacionPendienteService).guardarEmail('ana@example.com', 'ticket-prueba');
    auth.solicitarVerificacion('ana@example.com').subscribe();
    const envio = backend.expectOne(`${API_URL}/auth/send-verification`);
    expect(envio.request.method).toBe('POST');
    expect(envio.request.body).toEqual({ email: 'ana@example.com', reenviar: true });
    expect(envio.request.headers.get('X-Verification-Token')).toBe('ticket-prueba');
    expect(envio.request.headers.has('Authorization')).toBe(false);
    envio.flush({ verificada: false, enviado: true, enviadoAhora: true, retryAfterSeconds: 15, attemptsRemaining: 5, expiresInSeconds: 300 }, { status: 202, statusText: 'Accepted' });
    auth.verificarEmail('ana@example.com', '012345').subscribe();
    const confirmacion = backend.expectOne(`${API_URL}/auth/verify-email`);
    expect(confirmacion.request.body).toEqual({ email: 'ana@example.com', codigo: '012345' });
    expect(confirmacion.request.headers.has('Authorization')).toBe(false);
    confirmacion.flush({ ...tokens, accessToken: tokens.token, message: 'Email verificado', usuario: perfil });
    expect(auth.autenticado()).toBe(true);
    expect(auth.perfil()?.email).toBe('ana@example.com');
    expect(localStorage.getItem('refreshToken')).toBe('refresh-nuevo');
  });

  it('recupera una confirmación aplicada si se perdió su respuesta, sin decir código inválido', () => {
    const pending = TestBed.inject(verificacionPendienteService); pending.guardarEmail('ana@example.com', 'ticket');
    let exito = false;
    auth.verificarEmail('ana@example.com', '012345').subscribe(() => { exito = true; });
    backend.expectOne(`${API_URL}/auth/verify-email`).error(new ProgressEvent('error'));
    const status = backend.expectOne(`${API_URL}/auth/verification-status`);
    expect(status.request.headers.get('X-Verification-Token')).toBe('ticket');
    expect(status.request.body).toEqual({ email: 'ana@example.com' });
    status.flush({ verificada: true, enviado: false, enviadoAhora: false, retryAfterSeconds: 0, attemptsRemaining: 0, expiresInSeconds: 0 });
    expect(auth.autenticado()).toBe(false);
    backend.expectOne(`${API_URL}/auth/complete-verification`).flush({ ...tokens, accessToken: tokens.token, message: 'ok', usuario: perfil });
    expect(exito).toBe(true); expect(auth.autenticado()).toBe(true);
  });

  it('una respuesta incompleta no guarda tokens ni marca autenticación antes de recuperarla', () => {
    TestBed.inject(verificacionPendienteService).guardarEmail('ana@example.com', 'ticket');
    auth.verificarEmail('ana@example.com', '012345').subscribe({ error: () => undefined });
    backend.expectOne(`${API_URL}/auth/verify-email`).flush({ message: 'ok' });
    expect(localStorage.getItem('token')).toBeNull(); expect(auth.autenticado()).toBe(false);
    backend.expectOne(`${API_URL}/auth/verification-status`).flush({ verificada: false, enviado: true, enviadoAhora: false, retryAfterSeconds: 10, attemptsRemaining: 5, expiresInSeconds: 250 });
    expect(auth.autenticado()).toBe(false); backend.expectNone(`${API_URL}/auth/complete-verification`);
  });

  it('cancelar mientras verifica no revive una sesión al llegar una respuesta tardía', () => {
    const pending = TestBed.inject(verificacionPendienteService); pending.guardarEmail('ana@example.com', 'ticket');
    auth.verificarEmail('ana@example.com', '012345').subscribe({ error: () => undefined });
    pending.limpiar();
    backend.expectOne(`${API_URL}/auth/verify-email`).flush({ ...tokens, accessToken: tokens.token, message: 'ok', usuario: perfil });
    expect(auth.autenticado()).toBe(false); expect(localStorage.getItem('token')).toBeNull();
  });
});
