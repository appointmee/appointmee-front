import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { authService } from '../../services/auth-service';
import {
  DEBOUNCE_BUSQUEDA_MS,
  MIN_CARACTERES_BUSQUEDA,
  normalizarTerminoBusqueda,
  terminoDeBusqueda,
} from '../../shared/busqueda-sucursales';

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly mobileOpen = signal(false);
  private readonly scrolled = signal(false);
  private readonly currentYear = signal(new Date().getFullYear());
  private busquedaTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly isAuthenticated = inject(authService).autenticado;
  protected readonly searchTerm = signal('');
  protected readonly terminoMuyCorto = computed(() => {
    const termino = normalizarTerminoBusqueda(this.searchTerm());
    return termino.length > 0 && termino.length < MIN_CARACTERES_BUSQUEDA;
  });

  constructor() {
    this.destroyRef.onDestroy(() => this.cancelarBusqueda());
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
      this.closeMobile();
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

  protected onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchTerm.set(value);
    this.cancelarBusqueda();

    const termino = normalizarTerminoBusqueda(value);

    if (!termino) {
      // Vaciar el campo lleva al listado completo.
      this.irAResultados('');
      return;
    }

    if (termino.length < MIN_CARACTERES_BUSQUEDA) {
      return;
    }

    this.busquedaTimer = setTimeout(() => {
      this.busquedaTimer = null;
      this.irAResultados(terminoDeBusqueda(this.searchTerm()));
    }, DEBOUNCE_BUSQUEDA_MS);
  }

  protected submitSearch(event: Event): void {
    event.preventDefault();
    this.cancelarBusqueda();

    const valor = normalizarTerminoBusqueda(this.searchTerm());

    if (valor.length === 1) {
      return;
    }

    const termino = terminoDeBusqueda(valor);
    this.searchTerm.set(termino);
    this.irAResultados(termino);
  }

  protected clearSearch(): void {
    this.searchTerm.set('');
    this.cancelarBusqueda();
    this.irAResultados('');
  }

  private irAResultados(termino: string): void {
    this.closeMobile();
    void this.router.navigate(['/sucursales'], {
      queryParams: termino ? { busqueda: termino } : {},
    });
  }

  private cancelarBusqueda(): void {
    if (this.busquedaTimer !== null) {
      clearTimeout(this.busquedaTimer);
      this.busquedaTimer = null;
    }
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
