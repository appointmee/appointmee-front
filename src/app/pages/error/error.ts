import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, inject, signal, viewChild } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import { NavigationHistory } from '../../navigation-history';

const SAFE_REFERENCE = /^[A-Za-z0-9_-]{1,40}$/;

@Component({
  selector: 'app-error-page',
  imports: [RouterLink],
  templateUrl: './error.html',
  styleUrl: './error.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErrorPage {
  private readonly router = inject(Router);
  private readonly meta = inject(Meta);
  private readonly destroyRef = inject(DestroyRef);
  private readonly navigationHistory = inject(NavigationHistory);
  private readonly titleElement = viewChild<ElementRef<HTMLHeadingElement>>('titleElement');
  private readonly navigation = this.router.getCurrentNavigation();
  private readonly state = (this.navigation?.extras.state ?? history.state ?? {}) as Record<string, unknown>;

  protected readonly reference = this.safeReference(this.state['errorReference']);
  protected readonly retrying = signal(false);
  protected readonly returnTo = this.safeReturnTo(this.state['returnTo']);
  protected readonly canRetry = [500, 502, 503].includes(Number(this.state['status'])) && !!this.returnTo;

  constructor() {
    this.meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });
    afterNextRender(() => this.titleElement()?.nativeElement.focus());
    this.logErrorView();
    this.destroyRef.onDestroy(() => this.meta.removeTag('name="robots"'));
  }

  protected goBack(): void {
    const target = this.navigationHistory.backTarget(this.returnTo ?? undefined);
    void this.router.navigateByUrl(target ?? '/', { replaceUrl: true });
  }

  protected retry(): void {
    if (!this.canRetry || this.retrying()) return;
    this.retrying.set(true);
    void this.router.navigateByUrl(this.returnTo!, { replaceUrl: true }).then((navigated) => {
      if (!navigated) this.retrying.set(false);
    });
  }

  private safeReference(value: unknown): string | null {
    return typeof value === 'string' && SAFE_REFERENCE.test(value) ? value : null;
  }

  private safeReturnTo(value: unknown): string | null {
    return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/error')
      ? value
      : null;
  }

  private logErrorView(): void {
    // Contexto técnico mínimo y sin datos del usuario ni mensajes crudos del servidor.
    console.error('[AppointMee error view]', {
      screen: 'error',
      reference: this.reference,
      status: typeof this.state['status'] === 'number' ? this.state['status'] : undefined,
    });
  }
}
