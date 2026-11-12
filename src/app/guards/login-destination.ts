import { Router, UrlTree } from '@angular/router';

export function destinoDespuesDelLogin(router: Router, returnTo: string | null): UrlTree {
  if (esReturnToInternoValido(returnTo, router)) {
    // parseUrl conserva query string y hash del destino.
    return router.parseUrl(returnTo as string);
  }


  // El destino inicial después del login es el menú público de sucursales,
  // independientemente del rol. Los accesos restringidos siguen protegidos
  // por authGuard y sus validaciones de rol.
  return router.parseUrl('/sucursales');
}

function esReturnToInternoValido(returnTo: string | null, router: Router): boolean {
  if (!returnTo || !returnTo.startsWith('/') || returnTo.startsWith('//')) return false;
  if (/[\\\x00-\x1f]/.test(returnTo) || /^[a-z][a-z0-9+.-]*:/i.test(returnTo)) return false;

  try {
    const destino = router.parseUrl(returnTo);
    const primeraRuta = destino.root.children['primary']?.segments[0]?.path ?? '';

    if (primeraRuta === 'login') return false;

    return router.config.some(
      (route) => route.path !== '**' && route.path?.split('/')[0] === primeraRuta,
    );
  } catch {
    return false;
  }
}
