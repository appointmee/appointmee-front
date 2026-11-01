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
        provideRouter([{ path: 'sucursales', component: TestRoute }, { path: '', component: TestRoute }]),
        { provide: Reporte404, useValue: { registrar: () => undefined } },
      ],
    }).compileComponents();
  });

  it('searches branches from the 404 and keeps the search text in the URL', async () => {
    const fixture = TestBed.createComponent(NotFoundPage);
    fixture.detectChanges();
    const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('#busqueda-sucursal')!;
    input.value = 'Flores';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const button = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(button.disabled).toBe(false);
    button.click();
    await fixture.whenStable();

    const router = TestBed.inject(Router);
    expect(router.url.split('?')[0]).toBe('/sucursales');
    expect(router.parseUrl(router.url).queryParams['busqueda']).toBe('Flores');
  });
});
