import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  inject,
  signal,
} from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Auth } from '../../auth/auth';
import { BranchCategory } from '../../models/branch';
import { BranchSearch } from '../../services/branch-search';

@Component({
  selector: 'app-home',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home {
  private readonly auth = inject(Auth);
  protected readonly branchSearch = inject(BranchSearch);
  private readonly mobileOpen = signal(false);
  private readonly scrolled = signal(false);
  private readonly currentYear = signal(new Date().getFullYear());

  protected readonly isAuthenticated = this.auth.autenticado;

  protected submitSearch(event: Event): void {
    event.preventDefault();
    this.branchSearch.submit();
  }

  protected selectCategory(category: BranchCategory | null): void {
    this.branchSearch.selectCategory(category);
  }

  protected imageError(event: Event): void {
    (event.target as HTMLImageElement).hidden = true;
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
