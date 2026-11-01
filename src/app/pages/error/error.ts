import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, inject, viewChild } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';

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
  private readonly titleElement = viewChild<ElementRef<HTMLHeadingElement>>('titleElement');
  private readonly navigation = this.router.getCurrentNavigation();
  private readonly state = (this.navigation?.extras.state ?? history.state ?? {}) as Record<string, unknown>;

  protected readonly reference = this.safeReference(this.state['errorReference']);
  protected readonly canGoBack = this.hasInternalHistory();

  constructor() {
    this.meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });
    afterNextRender(() => this.titleElement()?.nativeElement.focus());
    this.logErrorView();
    this.destroyRef.onDestroy(() => this.meta.removeTag('name="robots"'));
  }

  protected goBack(): void {
    if (this.canGoBack) history.back();
    else void this.router.navigateByUrl('/');
  }

  private safeReference(value: unknown): string | null {
    return typeof value === 'string' && SAFE_REFERENCE.test(value) ? value : null;
  }

  private hasInternalHistory(): boolean {
    const previous = this.navigation?.previousNavigation;
    return !!previous && this.router.serializeUrl(previous.finalUrl ?? previous.extractedUrl).startsWith('/');
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
