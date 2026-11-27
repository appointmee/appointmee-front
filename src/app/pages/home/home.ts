import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  AfterViewInit,
  OnInit,
  inject,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { authService } from '../../services/auth-service';

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home implements OnInit, AfterViewInit {
  private readonly auth = inject(authService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject(ElementRef<HTMLElement>);
  private animationContext: ReturnType<typeof gsap.context> | null = null;

  protected readonly isAuthenticated = this.auth.autenticado;

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

  ngOnInit(): void {
    const qp = this.route.snapshot.queryParams;
    if (qp['busqueda'] || qp['categoria']) {
      void this.router.navigate(['/listado-sucursales'], { queryParams: qp });
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
          return Math.max(0, window.innerWidth - beeLeft + 900);
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
              ? hero.getBoundingClientRect().top + window.scrollY + window.innerHeight * 0.05
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
