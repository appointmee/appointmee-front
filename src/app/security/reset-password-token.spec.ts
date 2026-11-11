import { afterEach, describe, expect, it, vi } from 'vitest';
import { captureResetPasswordToken, consumeResetPasswordToken } from './reset-password-token';

describe('captura del token de recuperación', () => {
  afterEach(() => {
    consumeResetPasswordToken();
  });

  it('quita el token query del historial antes del bootstrap y lo entrega una sola vez', () => {
    const history = { state: null, replaceState: vi.fn() } as unknown as History;
    captureResetPasswordToken(
      { href: 'https://appointmee.example/reset-password?token=abcDEF_1234567890123456&campaign=spring' } as Location,
      history,
    );

    expect(history.replaceState).toHaveBeenCalledWith(null, '', '/reset-password?campaign=spring');
    expect(consumeResetPasswordToken()).toBe('abcDEF_1234567890123456');
    expect(consumeResetPasswordToken()).toBe('');
  });

  it('acepta un token en fragmento y elimina el fragmento del historial', () => {
    const history = { state: null, replaceState: vi.fn() } as unknown as History;
    captureResetPasswordToken(
      { href: 'https://appointmee.example/reset-password#token=fragment_token_1234567890123' } as Location,
      history,
    );

    expect(history.replaceState).toHaveBeenCalledWith(null, '', '/reset-password');
    expect(consumeResetPasswordToken()).toBe('fragment_token_1234567890123');
  });

  it('no altera URL de otras rutas ni captura sus parámetros token', () => {
    const history = { state: null, replaceState: vi.fn() } as unknown as History;
    captureResetPasswordToken(
      { href: 'https://appointmee.example/login?token=do-not-capture' } as Location,
      history,
    );

    expect(history.replaceState).not.toHaveBeenCalled();
    expect(consumeResetPasswordToken()).toBe('');
  });
});
