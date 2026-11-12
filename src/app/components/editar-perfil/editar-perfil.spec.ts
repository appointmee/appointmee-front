import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { authService } from '../../services/auth-service';
import { usuarioService } from '../../services/usuario-service';
import { EditarPerfil } from './editar-perfil';

describe('Editar perfil', () => {
  let fixture: ComponentFixture<EditarPerfil>;
  let host: HTMLElement;
  const perfil = {
    id: 9, nombre: 'Ana', apellido: 'Pérez', email: 'ana@example.com', fotoPerfil: null,
  };
  const usuarios = {
    obtenerPerfil: vi.fn(), modificarPerfil: vi.fn(), subirFotoPerfil: vi.fn(),
    descartarFotoSubida: vi.fn(), restablecerFotoPerfil: vi.fn(),
    solicitarCambioEmail: vi.fn(), confirmarCambioEmail: vi.fn(),
  };
  const auth = { perfil: () => ({ id: 9 }), validarToken: vi.fn(), limpiarSesion: vi.fn() };

  beforeEach(async () => {
    vi.resetAllMocks();
    usuarios.obtenerPerfil.mockReturnValue(of(perfil));
    usuarios.modificarPerfil.mockReturnValue(of('Usuario modificado'));
    usuarios.restablecerFotoPerfil.mockReturnValue(of('Foto eliminada'));
    usuarios.solicitarCambioEmail.mockReturnValue(of(undefined));
    usuarios.confirmarCambioEmail.mockReturnValue(of(undefined));
    auth.validarToken.mockReturnValue(of(undefined));
    await TestBed.configureTestingModule({
      imports: [EditarPerfil],
      providers: [
        provideRouter([]),
        { provide: usuarioService, useValue: usuarios },
        { provide: authService, useValue: auth },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(EditarPerfil);
    host = fixture.nativeElement;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  function escribir(selector: string, valor: string): void {
    const input = host.querySelector<HTMLInputElement>(selector)!;
    input.value = valor;
    input.dispatchEvent(new Event('input'));
  }

  function enviar(indice: number): void {
    host.querySelectorAll('form')[indice].dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();
  }

  it('habilita los datos con el lápiz y muestra los errores debajo del campo', async () => {
    expect(host.querySelector('#perfil-nombre')).toBeNull();
    expect(host.querySelector('#perfil-apellido')).toBeNull();
    const guardar = host.querySelector<HTMLButtonElement>('.datos__acciones button')!;
    expect(guardar.disabled).toBe(true);
    host.querySelector<HTMLButtonElement>('[aria-label="Editar nombre"]')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(guardar.disabled).toBe(true);
    escribir('#perfil-nombre', 'Andrea');
    fixture.detectChanges();
    expect(guardar.disabled).toBe(false);
    escribir('#perfil-nombre', ' Ana ');
    fixture.detectChanges();
    expect(guardar.disabled).toBe(true);
    escribir('#perfil-nombre', '12');
    enviar(0);
    expect(usuarios.modificarPerfil).not.toHaveBeenCalled();
    expect(host.querySelector('#nombre-error')?.textContent).toContain('3 y 60');

    usuarios.modificarPerfil.mockReturnValue(throwError(() => new HttpErrorResponse({
      status: 400, error: '{"apellido":"Revisá el apellido."}',
      headers: new HttpHeaders({ 'Content-Type': 'application/json' }),
    })));
    escribir('#perfil-nombre', 'Andrea');
    enviar(0);
    expect(usuarios.modificarPerfil).toHaveBeenCalledWith(9, { nombre: 'Andrea', apellido: 'Pérez' });
    expect(host.querySelector('#apellido-error')?.textContent).toContain('Revisá el apellido.');

    usuarios.modificarPerfil.mockReturnValue(of('Usuario modificado'));
    enviar(0);
    expect(host.textContent).toContain('Cambios guardados.');
    expect(host.querySelector('#perfil-nombre')).toBeNull();
    expect(guardar.form?.id).toBe('datos-perfil-form');
    expect(guardar.disabled).toBe(true);
  });

  it('sube una foto arrastrada, guarda la referencia y restablece las iniciales', () => {
    const url = 'https://example.com/foto.png';
    const archivo = new File(['png'], 'foto.png', { type: 'image/png' });
    usuarios.subirFotoPerfil.mockReturnValue(of({ url, publicId: 'appointmee/perfiles/foto' }));
    const botones = host.querySelectorAll<HTMLButtonElement>('.foto button');
    botones[0].click();
    fixture.detectChanges();
    const zona = host.querySelector('.subida')!;
    expect(zona.querySelector('button')?.textContent?.trim()).toBe('Elegir foto');
    expect(zona.querySelector('input[type="file"]')?.hasAttribute('hidden')).toBe(true);
    const dragover = new Event('dragover', { cancelable: true });
    Object.defineProperty(dragover, 'dataTransfer', { value: { types: ['Files'] } });
    zona.dispatchEvent(dragover);
    fixture.detectChanges();
    expect(zona.classList.contains('subida--activa')).toBe(true);
    zona.dispatchEvent(new Event('dragleave'));
    fixture.detectChanges();
    expect(zona.classList.contains('subida--activa')).toBe(false);
    const drop = new Event('drop', { cancelable: true });
    Object.defineProperty(drop, 'dataTransfer', { value: { files: [archivo] } });
    host.querySelector('.subida')!.dispatchEvent(drop);
    fixture.detectChanges();
    expect(usuarios.subirFotoPerfil).toHaveBeenCalledWith(archivo);
    expect(usuarios.modificarPerfil).toHaveBeenCalledWith(9, {
      fotoUrl: url, fotoPublicId: 'appointmee/perfiles/foto',
    });
    expect(host.querySelector('img')?.getAttribute('src')).toBe(url);
    botones[1].click();
    fixture.detectChanges();
    expect(usuarios.restablecerFotoPerfil).toHaveBeenCalledOnce();
    expect(host.querySelector('.iniciales')?.textContent).toBe('AP');
  });

  it('envía el código al nuevo correo y cierra sesión después de confirmarlo', async () => {
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(host.querySelector('.correo-actual__valor[aria-labelledby=correo-actual-etiqueta]')?.textContent).toBe('ana@example.com');
    host.querySelector<HTMLButtonElement>('[aria-label="Editar correo"]')!.click();
    fixture.detectChanges();
    expect(host.querySelector('[role="dialog"]')).not.toBeNull();
    await fixture.whenStable();
    expect(host.querySelector('[role="dialog"]')?.textContent).toContain('¿Seguro que querés cambiar');
    const aceptar = Array.from(host.querySelectorAll<HTMLButtonElement>('[role="dialog"] button'))
      .find((boton) => boton.textContent?.includes('Sí, cambiar correo'))!;
    aceptar.click();
    fixture.detectChanges();
    await fixture.whenStable();
    escribir('#correo-nuevo', ' NUEVO@example.com ');
    enviar(1);
    expect(usuarios.solicitarCambioEmail).toHaveBeenCalledWith('nuevo@example.com');
    expect(host.querySelector('[role="dialog"]')?.textContent).toContain('Código enviado al correo nuevo.');
    expect(host.querySelector('.correo-actual__valor[aria-labelledby=correo-actual-etiqueta]')?.textContent).toBe('ana@example.com');
    expect(auth.limpiarSesion).not.toHaveBeenCalled();
    await fixture.whenStable();
    expect(host.querySelector('[role="dialog"]')?.textContent).toContain('Reenviar en 60 s');
    expect(host.querySelector('[role="dialog"]')?.textContent).toContain('El código vence en 5:00');
    expect(host.querySelectorAll('.correo-modal__casillas input')).toHaveLength(6);
    const pegar = new Event('paste', { cancelable: true });
    Object.defineProperty(pegar, 'clipboardData', { value: { getData: () => '123456' } });
    host.querySelector('#correo-codigo-0')!.dispatchEvent(pegar);
    fixture.detectChanges();
    enviar(2);
    expect(usuarios.confirmarCambioEmail).toHaveBeenCalledWith('nuevo@example.com', '123456');
    expect(auth.limpiarSesion).toHaveBeenCalledOnce();
    expect(navegar).toHaveBeenCalledWith(['/login'], { state: { emailDesdeAjustes: true } });
  });
});
