import { DsButtonComponent } from '../../shared/ui/button/button.component';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, computed, inject, input, signal, viewChild } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NavigationHistory } from '../../navigation-history';
import { ReporteError } from './reporte-error';

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
  private readonly reporteError = inject(ReporteError);
  private readonly titleElement = viewChild<ElementRef<HTMLHeadingElement>>('titleElement');
  private readonly navigation = this.router.getCurrentNavigation();
  private readonly state = (this.navigation?.extras.state ?? history.state ?? {}) as Record<string, unknown>;

  protected readonly reference = this.safeReference(this.state['errorReference']);
  protected readonly retrying = signal(false);
  private readonly statusValue = this.state['status'] ?? this.route.snapshot.queryParamMap.get('status');
  protected readonly status = this.safeStatus(this.statusValue);
  protected readonly code = this.safeCode(this.state['code'], this.status);
  protected readonly returnTo = this.safeReturnTo(this.route.snapshot.queryParamMap.get('returnTo') ?? this.state['returnTo']);
  protected readonly canRetry = this.status !== null
    && [0, 500, 502, 503].includes(this.status) && !!this.returnTo;

  /** Estados de autenticación (401/403) con acciones de salida fijas de la pantalla. */
  protected readonly errorDeAutenticacion = computed(() => this.status === 401 || this.status === 403);

  /**
   * Permite reutilizar esta pantalla desde otras vistas (por ejemplo el detalle
   * de sucursal) sin duplicar el diseño de error existente.
   */
  readonly variant = input<ErrorPageVariant>('default');

  protected readonly heading = computed(() =>
    this.variant() === 'sucursal-no-encontrada'
      ? 'No encontramos esta sucursal'
      : this.status === 401 ? 'Error 401 - No autenticado'
      : this.status === 403 ? 'Error 403 - Acceso denegado'
      : this.status === 0 ? 'No pudimos conectarnos' : 'Algo salió mal',
  );

  protected readonly description = computed(() =>
    this.variant() === 'sucursal-no-encontrada'
      ? 'La sucursal que buscás no existe o ya no está disponible. Volvé al listado para elegir otra.'
      : this.status === 401
        ? 'No has iniciado sesión o tu sesión ha expirado. Iniciá sesión para acceder a esta sección.'
        : this.status === 403
          ? 'No tenés los permisos necesarios para acceder a esta sección.'
        : this.status === 0
          ? 'Revisá tu conexión e intentá de nuevo.'
          : 'No pudimos completar tu solicitud. Podés volver a intentarlo o continuar desde el inicio.',
  );

  constructor() {
    this.meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });
    afterNextRender(() => this.titleElement()?.nativeElement.focus());
    this.reporteError.registrar({ code: this.code, status: this.status }, this.reference);
    this.destroyRef.onDestroy(() => this.meta.removeTag('name="robots"'));
  }

  protected hasInternalHistory(): boolean {
    return this.navigationHistory.backTarget(this.router.url) !== null;
  }

  protected goBack(): void {
    const target = this.safeReturnTo(this.navigationHistory.backTarget(this.router.url));

    if (target) void this.router.navigateByUrl(target, { replaceUrl: true });
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

  private safeStatus(value: unknown): number | null {
    const status = Number(value);
    return value != null && Number.isInteger(status) && status >= 0 && status <= 599 ? status : null;
  }

  private safeCode(value: unknown, status: number | null): string {
    return typeof value === 'string' && /^[A-Z][A-Z0-9_]{0,60}$/.test(value)
      ? value
      : status === 0 ? 'NETWORK_ERROR' : `HTTP_${status ?? 'UNKNOWN'}`;
  }

  private safeReturnTo(value: unknown): string | null {
    return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/error') && !/[\\\x00-\x1f]/.test(value)
      ? value
      : null;
  }

}
