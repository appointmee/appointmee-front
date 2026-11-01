import { HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { NavigationEnd, PRIMARY_OUTLET, Router } from '@angular/router';
import {
  Subject,
  catchError,
  debounceTime,
  defer,
  filter,
  map,
  merge,
  of,
  switchMap,
  tap,
} from 'rxjs';
import {
  BRANCH_CATEGORIES,
  BranchCategory,
  BranchFilters,
  BranchSummary,
} from '../models/branch';
import { BranchService } from './branch.service';

interface SearchSuccess {
  readonly kind: 'success';
  readonly branches: readonly BranchSummary[];
}

interface SearchFailure {
  readonly kind: 'failure';
  readonly message: string;
}

type SearchResult = SearchSuccess | SearchFailure;

function normalizeTerm(value: string): string {
  return value.trim();
}

function comparisonKey(value: string): string {
  return normalizeTerm(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es');
}

function isValidTerm(value: string): boolean {
  const term = normalizeTerm(value);
  return term.length === 0 || term.length >= 2;
}

function isBranchCategory(value: string | null): value is BranchCategory {
  return !!value && (BRANCH_CATEGORIES as readonly string[]).includes(value);
}

@Injectable({ providedIn: 'root' })
export class BranchSearch {
  private readonly router = inject(Router);
  private readonly branchService = inject(BranchService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly submitted = new Subject<string>();
  private readonly requested = new Subject<BranchFilters>();
  private readonly retried = new Subject<void>();
  private currentFilters: BranchFilters = {};
  private categoriesRequested = false;
  private pendingTermKey: string | null = null;

  readonly search = new FormControl('', { nonNullable: true });
  readonly branches = signal<readonly BranchSummary[]>([]);
  readonly categories = signal<readonly BranchCategory[]>(BRANCH_CATEGORIES);
  readonly selectedCategory = signal<BranchCategory | null>(null);
  readonly appliedTerm = signal('');
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly term = signal('');
  readonly termTooShort = computed(() => {
    const term = normalizeTerm(this.term());
    return term.length === 1;
  });

  constructor() {
    merge(
      this.search.valueChanges.pipe(
        tap((value) => this.term.set(value)),
        debounceTime(350),
      ),
      this.submitted,
    )
      .pipe(
        map(normalizeTerm),
        filter(isValidTerm),
        takeUntilDestroyed(),
      )
      .subscribe((term) => this.navigateToSearch(term));

    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.restoreFromUrl());

    merge(
      this.requested,
      this.retried.pipe(map(() => this.currentFilters)),
    )
      .pipe(
        switchMap((filters) =>
          defer(() => {
            this.loading.set(true);
            this.error.set(null);

            return this.branchService.list(filters).pipe(
              map((branches): SearchResult => ({ kind: 'success', branches })),
              catchError((error: unknown) =>
                of<SearchResult>({ kind: 'failure', message: this.errorMessage(error) }),
              ),
            );
          }),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((result) => {
        this.loading.set(false);

        if (result.kind === 'failure') {
          this.error.set(result.message);
          return;
        }

        this.branches.set(result.branches);
      });
  }

  submit(): void {
    this.submitted.next(this.search.value);
  }

  clear(): void {
    this.search.setValue('', { emitEvent: false });
    this.term.set('');
    this.submitted.next('');
  }

  selectCategory(category: BranchCategory | null): void {
    if (category === this.selectedCategory()) {
      return;
    }

    void this.router.navigate(['/'], {
      queryParams: {
        busqueda: this.appliedTerm() || null,
        categoria: category,
      },
      queryParamsHandling: 'merge',
    });
  }

  clearFilters(): void {
    this.search.setValue('', { emitEvent: false });
    this.term.set('');
    void this.router.navigate(['/'], {
      queryParams: { busqueda: null, categoria: null },
      queryParamsHandling: 'merge',
    });
  }

  retry(): void {
    this.retried.next();
  }

  categoryLabel(category: BranchCategory): string {
    const label = category.replaceAll('_', ' ').toLocaleLowerCase('es');
    return `${label.charAt(0).toLocaleUpperCase('es')}${label.slice(1)}`;
  }

  private navigateToSearch(term: string): void {
    const tree = this.router.parseUrl(this.router.url);
    const currentTerm = tree.queryParams['busqueda'];
    const onHome = (tree.root.children[PRIMARY_OUTLET]?.segments.length ?? 0) === 0;
    const termKey = comparisonKey(term);

    if (
      this.pendingTermKey === termKey ||
      (onHome && comparisonKey(currentTerm ?? '') === termKey)
    ) {
      return;
    }

    this.pendingTermKey = termKey;
    void this.router.navigate(['/'], {
      queryParams: { busqueda: term || null },
      queryParamsHandling: 'merge',
    });
  }

  private restoreFromUrl(): void {
    const tree = this.router.parseUrl(this.router.url);
    const segments = tree.root.children[PRIMARY_OUTLET]?.segments ?? [];

    if (segments.length > 0) {
      return;
    }

    const queryTerm = normalizeTerm(tree.queryParams['busqueda'] ?? '');
    const term = isValidTerm(queryTerm) ? queryTerm : '';
    const categoryParam = tree.queryParams['categoria'] ?? null;
    const category = isBranchCategory(categoryParam) ? categoryParam : null;

    this.pendingTermKey = null;
    this.search.setValue(queryTerm, { emitEvent: false });
    this.term.set(queryTerm);
    this.appliedTerm.set(term);
    this.selectedCategory.set(category);
    this.currentFilters = {
      ...(term ? { nombre: term } : {}),
      ...(category ? { categoria: category } : {}),
    };

    this.loadCategories();
    this.requested.next(this.currentFilters);
  }

  private loadCategories(): void {
    if (this.categoriesRequested) {
      return;
    }

    this.categoriesRequested = true;
    this.branchService
      .getCategories()
      .pipe(
        catchError(() => of(BRANCH_CATEGORIES)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((categories) => this.categories.set(categories));
  }

  private errorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse && error.status === 0) {
      return 'No pudimos conectar con el servidor. Revisá tu conexión e intentá nuevamente.';
    }

    return 'No pudimos cargar las sucursales. Intentá nuevamente.';
  }
}
