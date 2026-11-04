import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { NotFoundPage } from './no-encontrada';
import { Reporte404 } from './reporte-404';

@Component({ standalone: true, template: '' })
class TestRoute {}

describe('NotFoundPage', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NotFoundPage],
      providers: [
        provideRouter([
          { path: 'sucursales', component: TestRoute },
          { path: '', component: TestRoute },
          { path: '**', component: TestRoute },
        ]),
        { provide: Reporte404, useValue: { registrar: () => undefined } },
      ],
    }).compileComponents();
  });

  it('ofrece buscar la sucursal detectada desde la ruta 404', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/sucursal/123');

    const fixture = TestBed.createComponent(NotFoundPage);
    fixture.detectChanges();

    const link = (fixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>(
      'a.page404__cta--sucursal',
    );
    expect(link).not.toBeNull();
    expect(link?.textContent).toContain('Buscar la sucursal 123');
    expect(link?.getAttribute('href')).toBe('/sucursales?busqueda=123');
  });

  it('offers both Home and a safe fallback from Volver when there is no internal route', async () => {
    const fixture = TestBed.createComponent(NotFoundPage);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('a[routerLink="/"]')?.textContent).toContain('Ir al Home');

    element.querySelector<HTMLButtonElement>('.page404__acciones button')!.click();
    await fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/');
  });
});
