import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { authService } from '../../services/auth-service';

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
  private readonly mobileOpen = signal(false);
  private readonly scrolled = signal(false);
  private readonly currentYear = signal(new Date().getFullYear());

  protected readonly isAuthenticated = inject(authService).autenticado;

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
