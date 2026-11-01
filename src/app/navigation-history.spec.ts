import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { NavigationHistory } from './navigation-history';

@Component({ standalone: true, template: '' })
class TestRoute {}

describe('NavigationHistory', () => {
  it('returns the prior internal route around a replaced failed route and avoids self-loops', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'home', component: TestRoute },
          { path: 'sucursales', component: TestRoute },
          { path: 'error', component: TestRoute },
        ]),
      ],
    });
    const history = TestBed.inject(NavigationHistory);
    const router = TestBed.inject(Router);

    await router.navigateByUrl('/home');
    await router.navigateByUrl('/sucursales?busqueda=Flores');
    await router.navigateByUrl('/error', { replaceUrl: true });
    expect(history.backTarget('/sucursales?busqueda=Flores')).toBe('/home');

    await router.navigateByUrl('/home', { replaceUrl: true });
    expect(history.backTarget()).toBeNull();
  });
});
