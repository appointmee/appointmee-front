import { Router, UrlTree } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { destinoDespuesDelLogin } from './login-destination';

function urlTreeDe(ruta: string): UrlTree {
  return { root: { children: { primary: { segments: [{ path: ruta }] } } } } as unknown as UrlTree;
}

describe('destinoDespuesDelLogin', () => {
  it('devuelve el returnTo válido cuando apunta a una ruta interna', () => {
    const destino = urlTreeDe('sucursales');
    const router = { parseUrl: () => destino, config: [{ path: 'sucursales' }] } as unknown as Router;
    expect(destinoDespuesDelLogin(router, '/sucursales?busqueda=Flores')).toBe(destino);
  });

  it('no acepta rutas absolutas externas ni protocolo relativo', () => {
    const router = { parseUrl: (url: string) => urlTreeDe(url.replace(/^\//, '')) } as unknown as Router;
    expect(destinoDespuesDelLogin(router, 'https://evil.example.com')).toBeDefined();
    expect(destinoDespuesDelLogin(router, '//evil.example.com')).toBeDefined();
  });

  it('no acepta el login como destino', () => {
    const router = { parseUrl: (url: string) => urlTreeDe(url.replace(/^\//, '')), config: [{ path: 'login' }] } as unknown as Router;
    expect(destinoDespuesDelLogin(router, '/login')).toBeDefined();
  });

  it('devuelve el destino por defecto ante un error inesperado', () => {
    const defaultDestino = urlTreeDe('sucursales');
    const router = { parseUrl: (u: string) => { if (u === '/sucursales') return defaultDestino; throw new Error('boom'); } } as unknown as Router;
    expect(destinoDespuesDelLogin(router, '/sucursales')).toBe(defaultDestino);
  });
});
