import { provideHttpClient } from '@angular/common/http';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';
import { Navbar } from '../components/navbar/navbar';
import { BranchFilters, BranchSummary } from '../models/branch';
import { Home } from '../pages/home/home';
import { BranchSearch } from './branch-search';
import { BranchService } from './branch.service';

@Component({ template: '' })
class EmptyPage {}

const CENTRO: BranchSummary = {
  id: 1,
  nombre: 'Centro',
  categoria: 'SPA',
  fotoPerfil: null,
  puntuacion: 4.5,
  cantidadPuntuaciones: 10,
};

const NORTE: BranchSummary = {
  ...CENTRO,
  id: 2,
  nombre: 'Norte',
};

describe('BranchSearch', () => {
  let router: Router;
  let search: BranchSearch;
  let list: ReturnType<typeof vi.fn>;
  let getCategories: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    list = vi.fn<(filters?: BranchFilters) => Observable<readonly BranchSummary[]>>(() => of([]));
    getCategories = vi.fn(() => of(['SPA', 'BARBERIA'] as const));

    TestBed.configureTestingModule({
      imports: [Home, Navbar],
      providers: [
        provideHttpClient(),
        provideRouter([
          { path: '', component: EmptyPage },
          { path: 'otra', component: EmptyPage },
        ]),
        {
          provide: BranchService,
          useValue: { list, getCategories },
        },
      ],
    });

    router = TestBed.inject(Router);
    search = TestBed.inject(BranchSearch);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('restores search and category from the URL and combines both filters', async () => {
    await router.navigateByUrl('/?busqueda=%20Centro%20&categoria=SPA');

    expect(search.search.value).toBe('Centro');
    expect(search.appliedTerm()).toBe('Centro');
    expect(search.selectedCategory()).toBe('SPA');
    expect(list).toHaveBeenCalledWith({ nombre: 'Centro', categoria: 'SPA' });
    expect(getCategories).toHaveBeenCalledOnce();
  });

  it('debounces for 350 ms and does not search one-character terms', async () => {
    await router.navigateByUrl('/');
    const navigate = vi.spyOn(router, 'navigate');
    navigate.mockClear();
    vi.useFakeTimers();

    search.search.setValue('c');
    await vi.advanceTimersByTimeAsync(350);
    expect(navigate).not.toHaveBeenCalled();

    search.search.setValue('centro');
    await vi.advanceTimersByTimeAsync(349);
    expect(navigate).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(['/'], {
      queryParams: { busqueda: 'centro' },
      queryParamsHandling: 'merge',
    });
  });

  it('submits immediately on Enter without duplicating the debounced navigation', async () => {
    await router.navigateByUrl('/');
    const navigate = vi.spyOn(router, 'navigate');
    navigate.mockClear();
    vi.useFakeTimers();

    search.search.setValue('  Centro  ');
    search.submit();

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(['/'], {
      queryParams: { busqueda: 'Centro' },
      queryParamsHandling: 'merge',
    });

    await vi.advanceTimersByTimeAsync(350);
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('navigates to Home when a search is applied from another page', async () => {
    await router.navigateByUrl('/otra');
    const navigate = vi.spyOn(router, 'navigate');
    navigate.mockClear();

    search.search.setValue('Palermo', { emitEvent: false });
    search.submit();

    expect(navigate).toHaveBeenCalledWith(['/'], {
      queryParams: { busqueda: 'Palermo' },
      queryParamsHandling: 'merge',
    });
  });

  it('clears the query while preserving the selected category', async () => {
    await router.navigateByUrl('/?busqueda=centro&categoria=SPA');

    search.clear();
    await vi.waitFor(() => expect(router.url).toBe('/?categoria=SPA'));

    expect(search.search.value).toBe('');
    expect(list).toHaveBeenLastCalledWith({ categoria: 'SPA' });
  });

  it('restores prior searches when navigation returns to an earlier URL', async () => {
    await router.navigateByUrl('/?busqueda=Centro');
    await router.navigateByUrl('/?busqueda=Norte');

    await router.navigateByUrl('/?busqueda=Centro');
    expect(search.search.value).toBe('Centro');
    expect(search.appliedTerm()).toBe('Centro');

    await router.navigateByUrl('/?busqueda=Norte');
    expect(search.search.value).toBe('Norte');
    expect(search.appliedTerm()).toBe('Norte');
  });

  it('shares the same form state between Navbar and Home', async () => {
    await router.navigateByUrl('/');
    const navbarFixture = TestBed.createComponent(Navbar);
    const homeFixture = TestBed.createComponent(Home);
    navbarFixture.detectChanges();
    homeFixture.detectChanges();
    const navbarSearch = (navbarFixture.componentInstance as unknown as { branchSearch: BranchSearch })
      .branchSearch;
    const homeSearch = (homeFixture.componentInstance as unknown as { branchSearch: BranchSearch })
      .branchSearch;
    const navbarInput = navbarFixture.nativeElement.querySelector(
      '#navbar-search input',
    ) as HTMLInputElement;
    const homeInput = homeFixture.nativeElement.querySelector('#branch-search') as HTMLInputElement;

    expect(navbarSearch).toBe(search);
    expect(homeSearch).toBe(search);

    search.search.setValue('Centro');
    navbarFixture.detectChanges();
    homeFixture.detectChanges();

    expect(navbarInput.value).toBe('Centro');
    expect(homeInput.value).toBe('Centro');
    expect(search.search.value).toBe('Centro');
  });

  it('keeps only the newest response when requests finish out of order', async () => {
    const centroResponse = new Subject<readonly BranchSummary[]>();
    const norteResponse = new Subject<readonly BranchSummary[]>();
    list.mockImplementation((filters?: BranchFilters) =>
      filters?.nombre === 'Centro' ? centroResponse : norteResponse,
    );

    await router.navigateByUrl('/?busqueda=Centro');
    await router.navigateByUrl('/?busqueda=Norte');

    norteResponse.next([NORTE]);
    norteResponse.complete();
    expect(search.branches()).toEqual([NORTE]);

    centroResponse.next([CENTRO]);
    centroResponse.complete();
    expect(search.branches()).toEqual([NORTE]);
  });

  it('preserves filters after an error and retries the same search', async () => {
    list
      .mockReturnValueOnce(throwError(() => new Error('network')))
      .mockReturnValueOnce(of([CENTRO]));

    await router.navigateByUrl('/?busqueda=Centro&categoria=SPA');

    expect(search.error()).toBe('No pudimos cargar las sucursales. Intentá nuevamente.');
    expect(search.search.value).toBe('Centro');

    search.retry();

    expect(list).toHaveBeenLastCalledWith({ nombre: 'Centro', categoria: 'SPA' });
    expect(search.error()).toBeNull();
    expect(search.branches()).toEqual([CENTRO]);
  });
});
