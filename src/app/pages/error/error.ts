import { DsButtonComponent } from '../../shared/ui/button/button.component';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, computed, inject, input, signal, viewChild } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NavigationHistory } from '../../navigation-history';

const SAFE_REFERENCE = /^[A-Za-z0-9_-]{1,40}$/;

export type ErrorPageVariant = 'default' | 'sucursal-no-encontrada';

@Component({
  selector: 'app-error-page',
  imports: [DsButtonComponent, RouterLink],
  templateUrl: './error.html',
  styleUrl: './error.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErrorPage {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly meta = inject(Meta);
  private readonly destroyRef = inject(DestroyRef);
  private readonly navigationHistory = inject(NavigationHistory);
  private readonly titleElement = viewChild<ElementRef<HTMLHeadingElement>>('titleElement');
  private readonly navigation = this.router.getCurrentNavigation();
  private readonly state = (this.navigation?.extras.state ?? history.state ?? {}) as Record<string, unknown>;

  protected readonly reference = this.safeReference(this.state['errorReference']);
  protected readonly retrying = signal(false);
  private readonly statusValue = this.state['status'] ?? this.route.snapshot.queryParamMap.get('status');
  protected readonly status = this.statusValue == null ? null : Number(this.statusValue);
  protected readonly returnTo = this.safeReturnTo(this.route.snapshot.queryParamMap.get('returnTo') ?? this.state['returnTo']);
  protected readonly canRetry = this.status !== null
    && [0, 500, 502, 503].includes(this.status) && !!this.returnTo;

  /**
   * Permite reutilizar esta pantalla desde otras vistas (por ejemplo el detalle
   * de sucursal) sin duplicar el diseño de error existente.
   */
  readonly variant = input<ErrorPageVariant>('default');

  protected readonly heading = computed(() =>
    this.variant() === 'sucursal-no-encontrada'
      ? 'No encontramos esta sucursal'
      : this.status === 0 ? 'No pudimos conectarnos' : 'Algo salió mal',
  );

  protected readonly description = computed(() =>
    this.variant() === 'sucursal-no-encontrada'
      ? 'La sucursal que buscás no existe o ya no está disponible. Volvé al listado para elegir otra.'
      : this.status === 0
        ? 'Revisá tu conexión e intentá de nuevo.'
        : 'No pudimos completar tu solicitud. Podés volver a intentarlo o continuar desde el inicio.',
  );

  constructor() {
    this.meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });
    afterNextRender(() => this.titleElement()?.nativeElement.focus());
    this.logErrorView();
    this.destroyRef.onDestroy(() => this.meta.removeTag('name="robots"'));
  }

protected goBack(): void {
  const target = this.navigationHistory.backTarget(this.router.url);

  if (target) {
    void this.router.navigateByUrl(target, { replaceUrl: true });
  }
}
  protected retry(): void {
    if (!this.canRetry || this.retrying()) return;
    this.retrying.set(true);
    void this.router.navigateByUrl(this.returnTo!, { replaceUrl: true }).then((navigated) => {
      if (!navigated) this.retrying.set(false);
    }).catch(() => this.retrying.set(false));
  }

  private safeReference(value: unknown): string | null {
    return typeof value === 'string' && SAFE_REFERENCE.test(value) ? value : null;
  }

  private safeReturnTo(value: unknown): string | null {
    return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/error') && !/[\\\x00-\x1f]/.test(value)
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
