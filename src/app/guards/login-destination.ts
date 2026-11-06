import { Router, UrlTree } from '@angular/router';

export function destinoDespuesDelLogin(router: Router, returnTo: string | null): UrlTree {
  if (!returnTo?.startsWith('/') || returnTo.startsWith('//') || /[\\\x00-\x1f]/.test(returnTo)) {
    return router.parseUrl('/sucursales');
  }

  try {
    const destino = router.parseUrl(returnTo);
    const primeraRuta = destino.root.children['primary']?.segments[0]?.path;

    // Evita volver al propio login o aceptar una ruta inexistente.
    const existe = router.config.some(route => route.path !== '**' && route.path?.split('/')[0] === (primeraRuta ?? ''));

    return primeraRuta !== 'login' && existe ? destino : router.parseUrl('/sucursales');
  } catch {
    return router.parseUrl('/sucursales');
  }
}
