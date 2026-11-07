import { Component, signal } from '@angular/core';
import { FormControl } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Navbar } from './navbar';
import { authService } from '../../services/auth-service';
import { BranchSearch } from '../../services/branch-search';

@Component({ selector: 'app-navbar-test-page', template: '' })
class EmptyPage {}

describe('Buscador del navbar', () => {
  beforeEach(() => TestBed.resetTestingModule());
  it('mantiene el navbar sin buscador en Home y en Sucursales', async () => {
    TestBed.configureTestingModule({
      imports: [Navbar],
      providers: [
        provideRouter([
          { path: '', component: EmptyPage },
          { path: 'sucursales', component: EmptyPage },
        ]),
        { provide: authService, useValue: {
          autenticado: signal(false), visitante: signal(true), restaurando: signal(false),
        } },
        { provide: BranchSearch, useValue: { search: new FormControl(''), term: signal('') } },
      ],
    });
    const router = TestBed.inject(Router);
    const fixture = TestBed.createComponent(Navbar);
    await router.navigateByUrl('/'); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#navbar-search')).toBeNull();
    await router.navigateByUrl('/sucursales?busqueda=pelu'); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#navbar-search')).toBeNull();
    expect(fixture.nativeElement.querySelector('.search-trigger')).toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.navbar__search-wrap')).toBeNull();
    await router.navigateByUrl('/'); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#navbar-search')).toBeNull();
  });
});
