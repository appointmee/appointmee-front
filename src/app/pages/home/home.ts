import { DsInputComponent } from '../../shared/ui/input/input.component';
import { DsButtonComponent } from '../../shared/ui/button/button.component';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  AfterViewInit,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
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
  imports: [DsInputComponent, DsButtonComponent, ReactiveFormsModule, RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home implements OnInit, AfterViewInit {
  private readonly auth = inject(authService);
  private readonly sucursalesService = inject(sucursalService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject(ElementRef<HTMLElement>);
  private animationContext: ReturnType<typeof gsap.context> | null = null;
  private searchFocused = false;
  private readonly lastSuggestionTerm = signal<string | null>(null);
  private readonly currentYear = signal(new Date().getFullYear());
  private busquedaTimer: ReturnType<typeof setTimeout> | null = null;

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
        distinctUntilChanged(
          (previous, current) => comparisonKey(previous) === comparisonKey(current),
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
    const resultadosActuales =
      !this.suggestionsLoading() &&
      !this.suggestionsError() &&
      comparisonKey(this.lastSuggestionTerm() ?? '') === comparisonKey(term);

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

  protected onHeroVisualPointerMove(event: PointerEvent): void {
    if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') {
      return;
    }

    const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const horizontalPosition = (event.clientX - bounds.left) / bounds.width;
    const verticalPosition = (event.clientY - bounds.top) / bounds.height;

    this.animationContext?.add(() => {
      gsap.to('.hero__orb--1', {
        x: (0.5 - horizontalPosition) * 24,
        y: (0.5 - verticalPosition) * 18,
        duration: 1.1,
        ease: 'power2.out',
        overwrite: 'auto',
      });
      gsap.to('.hero__orb--2', {
        x: (horizontalPosition - 0.5) * 16,
        y: (verticalPosition - 0.5) * 12,
        duration: 1.4,
        ease: 'power2.out',
        overwrite: 'auto',
      });
    });
  }

  protected resetHeroParallax(): void {
    this.animationContext?.add(() => {
      gsap.to('.hero__orb--1, .hero__orb--2', {
        x: 0,
        y: 0,
        duration: 1.2,
        ease: 'power2.out',
        overwrite: 'auto',
      });
    });
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

  @HostListener('document:keydown', ['$event'])
  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.closeSuggestions();
    }
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    const target = event.target;
    if (!(target instanceof Element) || !target.closest('.branch-search-wrap')) {
      this.closeSuggestions();
    }
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

  ngAfterViewInit(): void {
    if (
      typeof window.matchMedia !== 'function' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    gsap.registerPlugin(ScrollTrigger);
    const animationContext = gsap.context(() => {
      const beeFlight = this.host.nativeElement.querySelector(
        '.hero__bee-flight',
      ) as HTMLElement | null;
      const bee = this.host.nativeElement.querySelector('.hero__bee') as HTMLElement | null;
      gsap.to('.hero__bee-flight', {
        x: () => {
          if (!beeFlight || !bee) return 0;
          const beeLeft = bee.getBoundingClientRect().left;
          return Math.max(0, window.innerWidth - beeLeft + 48);
        },
        y: () => (window.innerWidth < 720 ? -24 : -70),
        rotation: 12,
        scale: 0.82,
        ease: 'none',
        scrollTrigger: {
          trigger: '.hero',
          start: () => {
            const hero = this.host.nativeElement.querySelector('.hero');
            return hero
              ? hero.getBoundingClientRect().top + window.scrollY + window.innerHeight * 0.2
              : window.innerHeight * 0.2;
          },
          end: 'bottom top',
          scrub: 0.6,
          invalidateOnRefresh: true,
        },
      });

      gsap.to('.hero__bee', {
        y: -9,
        rotation: 2,
        duration: 1.2,
        ease: 'sine.inOut',
        repeat: -1,
        yoyo: true,
      });

      gsap.fromTo(
        '.hero__content > .reveal, .hero__visual',
        { autoAlpha: 0, y: 28 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.85,
          stagger: 0.12,
          ease: 'power3.out',
          clearProps: 'opacity,visibility,transform',
        },
      );

      const scrollRevealGroups = [
        {
          elements: '.about__content > .reveal, .about__pillars .pillar, .about__visual',
          trigger: '.about__inner',
        },
        {
          elements: '.how .section__header .reveal, .steps .step',
          trigger: '.how .section__inner',
        },
      ];

      for (const group of scrollRevealGroups) {
        gsap.fromTo(
          group.elements,
          { autoAlpha: 0, y: 26 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.7,
            stagger: 0.09,
            ease: 'power2.out',
            clearProps: 'opacity,visibility,transform',
            scrollTrigger: {
              trigger: group.trigger,
              start: 'top 82%',
              once: true,
            },
          },
        );
      }

      for (const section of ['.about', '.how', '.cta']) {
        gsap.to(`${section} .section__glow`, {
          autoAlpha: 0.85,
          scale: 1,
          duration: 1.1,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: section,
            start: 'top 74%',
            once: true,
          },
        });
      }

      gsap.fromTo(
        '.steps__track-fill',
        { scaleY: 0 },
        {
          scaleY: 1,
          ease: 'none',
          scrollTrigger: {
            trigger: '.steps',
            start: 'top 72%',
            end: 'bottom 56%',
            scrub: true,
          },
        },
      );

      const steps = gsap.utils.toArray<HTMLElement>('.steps .step', this.host.nativeElement);
      for (const step of steps) {
        const number = step.querySelector<HTMLElement>('.step__number');
        if (!number) continue;

        gsap.to(number, {
          color: '#fff1c2',
          scale: 1.12,
          textShadow: '0 0 16px rgba(247, 198, 90, 0.62)',
          duration: 0.38,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: step,
            start: 'top 68%',
            toggleActions: 'play none none reverse',
          },
        });
      }

      gsap.set(
        '.booking-card__stage--selected, .booking-card__stage--confirmed, .hero-card__slot-check',
        {
          autoAlpha: 0,
        },
      );
      gsap.set('.hero-card__slot-check', { scale: 0.5, rotation: -30, transformOrigin: 'center' });
      gsap.set('.hero-card--float', { autoAlpha: 0, y: 14, scale: 0.9 });

      const selectionStep = steps[5];
      if (selectionStep) {
        const selectionTimeline = gsap.timeline({
          scrollTrigger: {
            trigger: selectionStep,
            start: 'top 68%',
            toggleActions: 'play none none reverse',
          },
        });
        selectionTimeline
          .to('.booking-card__stage--available', { autoAlpha: 0, duration: 0.2 }, 0)
          .to('.booking-card__stage--selected', { autoAlpha: 1, duration: 0.2 }, 0)
          .to(
            '.booking-card__slot--chosen',
            {
              backgroundColor: 'rgba(247, 198, 90, 0.9)',
              borderColor: 'rgba(247, 198, 90, 0.7)',
              color: '#211704',
              boxShadow: '0 14px 30px rgba(247, 198, 90, 0.24)',
              scale: 1.07,
              duration: 0.32,
              ease: 'power2.out',
            },
            0,
          )
          .to(
            '.hero-card__slot-check',
            { autoAlpha: 1, scale: 1, rotation: 0, duration: 0.28, ease: 'back.out(2)' },
            0.12,
          );
      }

      const confirmationStep = steps[6];
      if (confirmationStep) {
        const confirmationTimeline = gsap.timeline({
          scrollTrigger: {
            trigger: confirmationStep,
            start: 'top 68%',
            toggleActions: 'play none none reverse',
          },
        });
        confirmationTimeline
          .to('.booking-card__stage--selected', { autoAlpha: 0, duration: 0.18 }, 0)
          .to('.booking-card__stage--confirmed', { autoAlpha: 1, duration: 0.18 }, 0)
          .to(
            '.hero-card--float',
            { autoAlpha: 1, y: 0, scale: 1, duration: 0.45, ease: 'back.out(1.7)' },
            0.08,
          );
      }

      const ctaTimeline = gsap.timeline({
        scrollTrigger: {
          trigger: '.cta',
          start: 'top 74%',
          once: true,
        },
      });
      ctaTimeline
        .fromTo(
          '.cta__content > .reveal',
          { autoAlpha: 0, y: 30 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.72,
            stagger: 0.12,
            ease: 'power3.out',
            clearProps: 'opacity,visibility,transform',
          },
        )
        .fromTo(
          '.cta__actions .landing-btn--primary',
          { scale: 0.94 },
          { scale: 1, duration: 0.45, ease: 'back.out(2)', clearProps: 'transform' },
          '-=0.12',
        )
        .to('.cta__actions .landing-btn--primary', {
          boxShadow: '0 0 0 7px rgba(247, 198, 90, 0.16)',
          duration: 0.35,
          repeat: 1,
          yoyo: true,
          ease: 'power1.inOut',
        });

      gsap.to('.hero__title-accent', {
        backgroundPosition: '0% 50%',
        duration: 5,
        ease: 'sine.inOut',
        repeat: -1,
        yoyo: true,
      });
    }, this.host.nativeElement);
    this.animationContext = animationContext;

    this.destroyRef.onDestroy(() => {
      animationContext.revert();
      this.animationContext = null;
    });
  }
}
