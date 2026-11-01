import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';
import { authService } from '../services/auth-service';

interface NavItem {
  readonly label: string;
  readonly path: string;
  readonly icon: string;
  readonly exact: boolean;
  /** Si se define, el acceso solo aparece con alguno de estos roles (criterio 4 de US-HOME-06). */
  readonly roles?: readonly string[];
}

const ICONS = {
  home: 'M3 10.7 12 3l9 7.7V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V10.7Z',
  calendar:
    'M7 2v4M17 2v4M3 9h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z',
  store: 'M3 9h18M4 9l1.5-5h13L20 9M5 9v11h14V9M9 20v-6h6v6',
  user: 'M20 21a8 8 0 0 0-16 0M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
  inbox: 'M4 4h16v16H4zM4 13h4l2 3h4l2-3h4',
  settings:
    'M4 7h6M14 7h6M4 12h10M18 12h2M4 17h2M10 17h2M10 7a2 2 0 1 0 4 0 2 2 0 0 0-4 0ZM6 12a2 2 0 1 0 4 0 2 2 0 0 0-4 0ZM14 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0Z',
  shield: 'M12 3 19 6v5c0 4.4-3 8.2-7 9-4-.8-7-4.6-7-9V6l7-3Z',
  plus: 'M12 5v14M5 12h14',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.3-4.3',
  chevron: 'm9 18 6-6-6-6',
};

@Component({
  selector: 'app-navbar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-navbar' },
})
export class Navbar {
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly auth = inject(authService);

  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');
  private readonly burger = viewChild<ElementRef<HTMLButtonElement>>('burger');
  private readonly sheet = viewChild<ElementRef<HTMLElement>>('sheet');

  private readonly rutaActual = signal(this.router.url);

  protected readonly navbarSimple = computed(() => {
    const ruta = this.rutaActual().split(/[?#]/)[0];

    return ruta === '/login'
      || ruta === '/configuracion/verificar-email'
      || ruta === '/verificar-email';
  });

  protected readonly mobileOpen = signal(false);
  protected readonly profileOpen = signal(false);
  protected readonly searchOpen = signal(false);
  protected readonly scrolled = signal(false);
  protected readonly searchTerm = signal('');
  protected readonly icons = ICONS;

  /** Siempre visibles para cualquier usuario autenticado (criterio 2). */
  protected readonly linksBase: readonly NavItem[] = [
    { label: 'Home', path: '/', icon: ICONS.home, exact: true },
    { label: 'Sucursales', path: '/sucursales', icon: ICONS.store, exact: false },
    { label: 'Mis Turnos', path: '/mis-turnos', icon: ICONS.calendar, exact: false },
  ];

  /** Disponibles solo con el rol correspondiente (criterio 3, 4). */
  protected readonly linksPorRol: readonly NavItem[] = [
    { label: 'Mis Sucursales', path: '/mis-sucursales', icon: ICONS.store, exact: false, roles: ['EMPLEADOR'] },
    { label: 'Administración', path: '/admin', icon: ICONS.shield, exact: false, roles: ['ADMINISTRADOR'] },
  ];

  /** Accesos del menú de perfil, disponibles para cualquier usuario autenticado. */
  protected readonly linksCuenta: readonly NavItem[] = [
    { label: 'Mi Perfil', path: '/perfil', icon: ICONS.user, exact: false },
    { label: 'Solicitudes', path: '/solicitudes', icon: ICONS.inbox, exact: false },
    { label: 'Ajustes', path: '/configuracion', icon: ICONS.settings, exact: false },
  ];

  protected readonly primaryLinks = computed(() => [
    ...this.linksBase,
    ...this.linksPorRol.filter((link) =>
      this.auth.tieneAlgunRol(...(link.roles ?? [])),
    ),
  ]);

  constructor() {
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((event) => {
        this.rutaActual.set(event.urlAfterRedirects);
        this.closeAll();
      });

    this.destroyRef.onDestroy(() => {
      document.body.classList.remove('nav-locked');
    });
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    this.profileOpen.set(false);

    const target = event.target;

    if (target instanceof Element && target.closest('.navbar__search-wrap, .search-trigger')) {
      return;
    }

    this.searchOpen.set(false);
  }

  @HostListener('document:keydown', ['$event'])
  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      // Al cerrar con Escape se devuelve el foco al botón hamburguesa.
      this.closeAll(true);
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.openSearch();
    }
  }

  @HostListener('window:scroll')
  protected onScroll(): void {
    this.scrolled.set(window.scrollY > 8);
  }

  @HostListener('window:resize')
  protected onResize(): void {
    if (window.innerWidth > 1024 && this.mobileOpen()) {
      this.closeMobile();
    }
  }

  protected toggleMobile(): void {
    if (this.auth.restaurando()) {
      return;
    }

    const open = !this.mobileOpen();

    this.mobileOpen.set(open);
    this.profileOpen.set(false);
    this.searchOpen.set(false);
    document.body.classList.toggle('nav-locked', open);

    if (open) {
      // Gestión de foco (criterio 6): el primer link del menú recibe el foco.
      setTimeout(() => {
        const primerFoco = this.sheet()?.nativeElement.querySelector<HTMLElement>(
          'a[href], button:not([disabled])',
        );
        primerFoco?.focus();
      });
    }
  }

  protected closeMobile(devolverFoco: boolean = false): void {
    this.mobileOpen.set(false);
    document.body.classList.remove('nav-locked');

    if (devolverFoco) {
      setTimeout(() => this.burger()?.nativeElement.focus());
    }
  }

  /** Trampa de foco dentro del menú mobile mientras está abierto (criterio 6). */
  protected atraparFoco(event: Event): void {
    if ((event as KeyboardEvent).key !== 'Tab') {
      return;
    }

    const tabEvent = event as KeyboardEvent;
    const contenedor = this.sheet()?.nativeElement;
    if (!contenedor) {
      return;
    }

    const enfocables = Array.from(
      contenedor.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'),
    );

    if (enfocables.length === 0) {
      return;
    }

    const primero = enfocables[0];
    const ultimo = enfocables[enfocables.length - 1];
    const activo = document.activeElement;

    if (!contenedor.contains(activo)) {
      tabEvent.preventDefault();
      primero?.focus();
    } else if (tabEvent.shiftKey && activo === primero) {
      tabEvent.preventDefault();
      ultimo?.focus();
    } else if (!tabEvent.shiftKey && activo === ultimo) {
      tabEvent.preventDefault();
      primero?.focus();
    }
  }

  protected toggleProfile(event: MouseEvent): void {
    event.stopPropagation();
    this.profileOpen.update((open) => !open);
    this.searchOpen.set(false);
  }

  protected openSearch(): void {
    if (this.navbarSimple()) {
      return;
    }

    this.searchOpen.set(true);
    this.profileOpen.set(false);
    this.closeMobile();
    setTimeout(() => this.searchInput()?.nativeElement.focus());
  }

  protected closeSearch(): void {
    this.searchOpen.set(false);
  }

  protected updateSearch(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  protected clearSearch(): void {
    this.searchTerm.set('');
    this.searchInput()?.nativeElement.focus();
  }

  protected submitSearch(event: Event): void {
    event.preventDefault();

    const term = this.searchTerm().trim();

    this.closeSearch();
    this.closeMobile();

    void this.router.navigate(['/sucursales'], term ? { queryParams: { busqueda: term } } : {});
  }

  protected logout(): void {
    this.closeAll();
    const volver = () => { void this.router.navigate(['/login']); };
    this.auth.logout().subscribe({ next: volver, error: volver });
  }

  protected closeAll(devolverFoco: boolean = false): void {
    this.profileOpen.set(false);
    this.searchOpen.set(false);
    this.closeMobile(devolverFoco);
  }
}
