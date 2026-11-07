import { provideHttpClient } from '@angular/common/http';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Observable, Subject, of } from 'rxjs';

import { SucursalMiniDTO } from '../../models/sucursal';
import { sucursalService } from '../../services/sucursal-service';
import { Home } from './home';

@Component({ template: '' })
class EmptyPage {}

const PELUQUERIA: SucursalMiniDTO = {
  id: 17,
  nombre: 'Peluquería Centro',
  categoria: 'PELUQUERIA',
  fotoPerfil: null,
  puntuacion: 4,
  cantidadPuntuaciones: 8,
};

describe('Home branch autocomplete', () => {
  let router: Router;
  let filtrar: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    filtrar = vi.fn<
      (categoria?: string | null, nombre?: string | null) => Observable<SucursalMiniDTO[]>
    >(() => of([]));

    TestBed.configureTestingModule({
      imports: [Home],
      providers: [
        provideHttpClient(),
        provideRouter([
          { path: '', component: EmptyPage },
          { path: 'sucursales', component: EmptyPage },
          { path: 'sucursal/:id', component: EmptyPage },
        ]),
        { provide: sucursalService, useValue: { filtrar } },
      ],
    });

    router = TestBed.inject(Router);
  });

  afterEach(() => vi.useRealTimers());

  it('does not render the former available branches section', () => {
    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.branches')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Sucursales disponibles');
  });

  it('waits for two characters and debounces backend suggestions for 350 ms', async () => {
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('#branch-search') as HTMLInputElement;

    input.focus();
    input.value = 'p';
    input.dispatchEvent(new Event('input'));
    await vi.advanceTimersByTimeAsync(350);
    expect(filtrar).not.toHaveBeenCalled();

    input.value = 'pe';
    input.dispatchEvent(new Event('input'));
    await vi.advanceTimersByTimeAsync(349);
    expect(filtrar).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(filtrar).toHaveBeenCalledOnce();
    expect(filtrar).toHaveBeenCalledWith(null, 'pe');
  });

  it('keeps only the newest autocomplete response', async () => {
    vi.useFakeTimers();
    const first = new Subject<SucursalMiniDTO[]>();
    const second = new Subject<SucursalMiniDTO[]>();
    filtrar.mockReturnValueOnce(first).mockReturnValueOnce(second);
    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('#branch-search') as HTMLInputElement;

    input.focus();
    input.value = 'pe';
    input.dispatchEvent(new Event('input'));
    await vi.advanceTimersByTimeAsync(350);
    input.value = 'pelu';
    input.dispatchEvent(new Event('input'));
    await vi.advanceTimersByTimeAsync(350);

    second.next([PELUQUERIA]);
    fixture.detectChanges();
    first.next([]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(PELUQUERIA.nombre);
  });

  it('opens the existing detail route when a suggestion is selected', async () => {
    vi.useFakeTimers();
    filtrar.mockReturnValue(of([PELUQUERIA]));
    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('#branch-search') as HTMLInputElement;

    input.focus();
    input.value = 'pelu';
    input.dispatchEvent(new Event('input'));
    await vi.advanceTimersByTimeAsync(350);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.branch-suggestion') as HTMLButtonElement).click();

    await vi.waitFor(() => expect(router.url).toBe('/sucursal/17'));
  });

  it('navigates to the branches page with busqueda when the form is submitted', async () => {
    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('#branch-search') as HTMLInputElement;
    const form = fixture.nativeElement.querySelector('.branch-search') as HTMLFormElement;

    input.value = 'pelu';
    input.dispatchEvent(new Event('input'));
    form.dispatchEvent(new Event('submit'));

    await vi.waitFor(() => expect(router.url).toBe('/sucursales?busqueda=pelu'));
  });

  it('Enter with multiple results preserves the search in the listing even after hovering', async () => {
    vi.useFakeTimers();
    filtrar.mockReturnValue(of([PELUQUERIA, { ...PELUQUERIA, id: 18, nombre: 'Peluquería Norte' }]));
    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('#branch-search') as HTMLInputElement;
    input.focus();
    input.value = '  pelu  ';
    input.dispatchEvent(new Event('input'));
    await vi.advanceTimersByTimeAsync(350);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('.branch-suggestion').dispatchEvent(new MouseEvent('mouseenter'));
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    input.dispatchEvent(enter);
    expect(enter.defaultPrevented).toBe(false);
    fixture.nativeElement.querySelector('.branch-search').dispatchEvent(new Event('submit'));
    await vi.waitFor(() => expect(router.url).toBe('/sucursales?busqueda=pelu'));
  });

  it('Enter opens the detail when the current search has exactly one result', async () => {
    vi.useFakeTimers();
    filtrar.mockReturnValue(of([PELUQUERIA]));
    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('#branch-search') as HTMLInputElement;
    input.focus();
    input.value = 'pelu';
    input.dispatchEvent(new Event('input'));
    await vi.advanceTimersByTimeAsync(350);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('.branch-search').dispatchEvent(new Event('submit'));
    await vi.waitFor(() => expect(router.url).toBe('/sucursal/17'));
  });

  it('does not use a previous single result while a different search is pending', async () => {
    vi.useFakeTimers();
    filtrar.mockReturnValue(of([PELUQUERIA]));
    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('#branch-search') as HTMLInputElement;
    input.value = 'pelu'; input.dispatchEvent(new Event('input'));
    await vi.advanceTimersByTimeAsync(350);
    input.value = 'barbería'; input.dispatchEvent(new Event('input'));
    fixture.nativeElement.querySelector('.branch-search').dispatchEvent(new Event('submit'));
    await vi.waitFor(() => expect(decodeURI(router.url)).toBe('/sucursales?busqueda=barbería'));
  });

  it('allows selecting a particular suggestion with arrows and Enter', async () => {
    vi.useFakeTimers();
    filtrar.mockReturnValue(of([PELUQUERIA, { ...PELUQUERIA, id: 18 }]));
    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('#branch-search') as HTMLInputElement;
    input.focus(); input.value = 'pelu'; input.dispatchEvent(new Event('input'));
    await vi.advanceTimersByTimeAsync(350); fixture.detectChanges();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    input.dispatchEvent(enter);
    expect(enter.defaultPrevented).toBe(true);
    await vi.waitFor(() => expect(router.url).toBe('/sucursal/18'));
  });
});
