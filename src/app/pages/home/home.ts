import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { catchError, distinctUntilChanged, map, of, switchMap, tap, timer } from 'rxjs';

import { authService } from '../../services/auth-service';
import { SucursalMiniDTO } from '../../models/sucursal';
import { sucursalService } from '../../services/sucursal-service';

interface SuggestionResult {
  readonly term: string;
  readonly suggestions: readonly SucursalMiniDTO[];
  readonly error: string | null;
}

function comparisonKey(value: string): string {
  return value.trim().toLocaleLowerCase('es');
}

@Component({
  selector: 'app-home',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home implements OnInit {
  private readonly auth = inject(authService);
  private readonly sucursalesService = inject(sucursalService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private searchFocused = false;
  private readonly lastSuggestionTerm = signal<string | null>(null);
  private readonly mobileOpen = signal(false);
  private readonly scrolled = signal(false);
  private readonly currentYear = signal(new Date().getFullYear());

  protected readonly isAuthenticated = this.auth.autenticado;
  protected readonly search = new FormControl('', { nonNullable: true });
  protected readonly suggestions = signal<readonly SucursalMiniDTO[]>([]);
  protected readonly suggestionsOpen = signal(false);
  protected readonly suggestionsLoading = signal(false);
  protected readonly suggestionsError = signal<string | null>(null);
  protected readonly activeSuggestionIndex = signal(-1);
  protected readonly term = signal('');
  protected readonly termTooShort = computed(() => this.term().trim().length === 1);

  constructor() {
    this.search.valueChanges
      .pipe(
        map((value) => value.trim()),
        tap(() => this.term.set(this.search.value)),
        distinctUntilChanged((previous, current) =>
          comparisonKey(previous) === comparisonKey(current),
        ),
        tap(() => {
          this.suggestions.set([]);
          this.suggestionsError.set(null);
          this.suggestionsLoading.set(false);
          this.suggestionsOpen.set(false);
          this.activeSuggestionIndex.set(-1);
          this.lastSuggestionTerm.set(null);
        }),
        switchMap((term) => {
          if (term.length < 2) {
            return of<SuggestionResult>({ term, suggestions: [], error: null });
          }

          return timer(350).pipe(
            tap(() => {
              this.suggestionsLoading.set(true);
              this.suggestionsOpen.set(this.searchFocused);
            }),
            switchMap(() =>
              this.sucursalesService.filtrar(null, term).pipe(
                map((suggestions): SuggestionResult => ({ term, suggestions, error: null })),
                catchError(() =>
                  of<SuggestionResult>({
                    term,
                    suggestions: [],
                    error: 'No pudimos cargar las sugerencias. Intentá nuevamente.',
                  }),
                ),
              ),
            ),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        this.suggestionsLoading.set(false);
        this.suggestions.set(result.suggestions);
        this.suggestionsError.set(result.error);
        this.lastSuggestionTerm.set(result.term);
        this.suggestionsOpen.set(this.searchFocused && result.term.length >= 2);
      });
  }

  protected submitSearch(event: Event): void {
    event.preventDefault();
    const term = this.search.value.trim();
    if (term.length < 2) {
      return;
    }

    const suggestions = this.suggestions();
    const resultadosActuales = !this.suggestionsLoading() && !this.suggestionsError()
      && comparisonKey(this.lastSuggestionTerm() ?? '') === comparisonKey(term);

    if (resultadosActuales && suggestions.length === 1) {
      this.selectSuggestion(suggestions[0]);
      return;
    }

    this.closeSuggestions();
    void this.router.navigate(['/sucursales'], {
      queryParams: { busqueda: term },
    });
  }

  protected clearSearch(): void {
    this.search.setValue('');
  }

  protected onSearchFocus(): void {
    this.searchFocused = true;
    const term = this.search.value.trim();
    if (
      term.length >= 2 &&
      (this.suggestionsLoading() ||
        comparisonKey(this.lastSuggestionTerm() ?? '') === comparisonKey(term))
    ) {
      this.suggestionsOpen.set(true);
    }
  }

  protected onSuggestionImageError(event: Event): void {
    (event.target as HTMLImageElement).hidden = true;
  }

  protected onSearchKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeSuggestions();
      return;
    }

    const suggestions = this.suggestions();
    if (!this.suggestionsOpen() || suggestions.length === 0) {
      return;
    }

    // Enter confirma una opción elegida explícitamente con las flechas.
    if (event.key === 'Enter' && this.activeSuggestionIndex() >= 0) {
      event.preventDefault();
      this.selectSuggestion(suggestions[this.activeSuggestionIndex()]);
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.activeSuggestionIndex.update((index) => (index + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.activeSuggestionIndex.update((index) =>
        index <= 0 ? suggestions.length - 1 : index - 1,
      );
    }
  }

  protected selectSuggestion(sucursal: SucursalMiniDTO): void {
    this.search.setValue(sucursal.nombre, { emitEvent: false });
    this.term.set(sucursal.nombre);
    this.closeSuggestions();
    void this.router.navigate(['/sucursal', sucursal.id]);
  }

  protected categoryLabel(category: string): string {
    const label = category.replaceAll('_', ' ').toLocaleLowerCase('es');
    return `${label.charAt(0).toLocaleUpperCase('es')}${label.slice(1)}`;
  }

  @HostListener('window:scroll')
  protected onScroll(): void {
    this.scrolled.set(window.scrollY > 12);
  }

  @HostListener('window:resize')
  protected onResize(): void {
    if (window.innerWidth > 1024 && this.mobileOpen()) {
      this.closeMobile();
    }
  }

  @HostListener('document:keydown', ['$event'])
  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.closeSuggestions();
      this.closeMobile();
    }
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    const target = event.target;
    if (!(target instanceof Element) || !target.closest('.branch-search-wrap')) {
      this.closeSuggestions();
    }
  }

  protected toggleMobile(): void {
    this.mobileOpen.update((open) => !open);
    if (this.mobileOpen()) {
      document.body.classList.add('nav-locked');
    } else {
      document.body.classList.remove('nav-locked');
    }
  }

  protected closeMobile(): void {
    this.mobileOpen.set(false);
    document.body.classList.remove('nav-locked');
  }

  private closeSuggestions(): void {
    this.searchFocused = false;
    this.suggestionsOpen.set(false);
    this.activeSuggestionIndex.set(-1);
  }

  ngOnInit(): void {
    const qp = this.route.snapshot.queryParams;
    if (qp['busqueda'] || qp['categoria']) {
      void this.router.navigate(['/sucursales'], { queryParams: qp });
    }
  }

  protected scrollToSection(event: Event, sectionId: string): void {
    event.preventDefault();
    const element = document.getElementById(sectionId);
    if (element) {
      const navHeight = 86;
      const top = element.getBoundingClientRect().top + window.scrollY - navHeight;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  }
}
