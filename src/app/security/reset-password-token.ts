let pendingResetPasswordToken: string | null = null;

/** Captura y quita el token del enlace antes del bootstrap de Angular y analytics. */
export function captureResetPasswordToken(location: Location, history: History): void {
  const url = new URL(location.href);
  if (url.pathname !== '/reset-password') return;

  const fromQuery = url.searchParams.get('token');
  const fragmentParams = new URLSearchParams(url.hash.replace(/^#/, ''));
  const fromFragment = fragmentParams.get('token');
  const token = fromFragment || fromQuery;
  if (!token) return;

  pendingResetPasswordToken = token;
  url.searchParams.delete('token');
  if (fromFragment) url.hash = '';

  history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`);
}

/** Consume el token una sola vez; no lo persiste en almacenamiento del navegador. */
export function consumeResetPasswordToken(): string {
  const token = pendingResetPasswordToken ?? '';
  pendingResetPasswordToken = null;
  return token;
}
