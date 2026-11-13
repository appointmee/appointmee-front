import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { authService } from '../services/auth-service';
import { SIN_MANEJO_GLOBAL_DE_ERRORES } from './error-handling-context';
import type { FrontendError } from '../models/frontend-error';

export interface ApiError extends FrontendError {
  readonly fields: Readonly<Record<string, string>>;
  readonly reference: string;
  readonly code: string;
  readonly verificationToken?: string;
  readonly verificationExpiresIn?: number;
  readonly attemptsRemaining?: number;
  readonly retryAfterSeconds?: number;
}

const SAFE_MESSAGES: Readonly<Record<number, string>> = {
  401: 'Tu sesión expiró. Iniciá sesión para continuar.',
  403: 'No tenés permisos para realizar esta acción.',
  404: 'No encontramos lo que buscabas.',
  429: 'Demasiados intentos. Esperá unos segundos e intentá de nuevo.',
  500: 'Tuvimos un problema. Probá de nuevo en unos segundos.',
  502: 'Tuvimos un problema. Probá de nuevo en unos segundos.',
  503: 'Tuvimos un problema. Probá de nuevo en unos segundos.',
  0: 'No pudimos conectarnos. Revisá tu conexión.',
};

const BACKEND_CODES = new Set([
  'REGISTRATION_PENDING_VERIFICATION', 'EMAIL_NOT_VERIFIED', 'EMAIL_ALREADY_VERIFIED',
  'VERIFICATION_CODE_INVALID', 'VERIFICATION_CODE_EXPIRED', 'VERIFICATION_ATTEMPTS_EXCEEDED',
  'VERIFICATION_SESSION_FAILED',
  'CURRENT_PASSWORD_INVALID', 'NEW_PASSWORD_REUSED',
]);

function codeForStatus(status: number): string {
  return status === 0 ? 'NETWORK_ERROR' : `HTTP_${status}`;
}

@Injectable({ providedIn: 'root' })
export class apiErrorsService {

  readonly notice =
  signal<{
    error: ApiError;
    retry?: () => void; retrying?: boolean } |
    null>(null,);


    /*

    transforma un error HTTP en un error ApiError (models)
    que angular puede usar para mostrar
    mensajes y manejar errores dentro de appointmee

    osea los errores del backend los transforma y toma decisiones sobre ellos

    */
  map(response: HttpErrorResponse): ApiError {
    const reference = crypto.randomUUID();


    const conflictCode = response.error &&
      typeof response.error === 'object' ?
      (response.error as { code?: unknown }).code :
      undefined;


    const conflictText = typeof response.error === 'string' ? response.error.toLowerCase() : '';

    const duplicateEmail =
      conflictCode === 'EMAIL_ALREADY_EXISTS' ||
      /email.{0,30}(registrad|exist)|ya existe.{0,20}email/.test(conflictText);


    const fields =
      response.status === 400 ||
      response.status === 422 ?
      this.fieldErrors(response.error):
      response.status === 409 && duplicateEmail ?
      { email: 'Este email ya está registrado.' } :
      { };


    const message =
      response.status === 409
        ? this.safeConflictMessage(response.error)
        : (SAFE_MESSAGES[response.status] ??
          'Ocurrió un error inesperado. Volvé al inicio e intentá nuevamente.');

    const code = typeof conflictCode === 'string' && BACKEND_CODES.has(conflictCode)
      ? conflictCode
      : codeForStatus(response.status);
    const verificationToken = code === 'EMAIL_NOT_VERIFIED' && response.status === 403
      && typeof response.error?.verificationToken === 'string' ? response.error.verificationToken : undefined;

    const verificationExpiresIn = Number.isFinite(response.error?.verificationExpiresIn)
      ? response.error.verificationExpiresIn : undefined;

    const attemptsRemaining = Number.isInteger(response.error?.attemptsRemaining)
      ? response.error.attemptsRemaining : undefined;

    const retryAfter = response.headers.get('Retry-After') ?? (Number.isFinite(response.error?.retryAfterSeconds) ? String(response.error.retryAfterSeconds) : null);

    const seconds = retryAfter && /^\d+$/.test(retryAfter)
      ? Number(retryAfter)
      : retryAfter ? Math.ceil((Date.parse(retryAfter) - Date.now()) / 1000) : 0;

    const retryAfterSeconds = Number.isFinite(seconds) && seconds > 0 ? seconds : undefined;

    return { status: response.status, message, fields, reference, code, retryAfterSeconds, verificationToken, verificationExpiresIn, attemptsRemaining };
  }

  dismiss(): void {
    this.notice.set(null);
  }

  private fieldErrors(body: unknown): Record<string, string> {
    if (!body || typeof body !== 'object') return {};
    const record = body as Record<string, unknown>;
    const candidate =
      record['fields'] && typeof record['fields'] === 'object'
        ? (record['fields'] as Record<string, unknown>)
        : record;
    const result: Record<string, string> = {};
    for (const key of Object.keys(candidate)) {
      if (
        !/^[A-Za-z][A-Za-z0-9_.-]{0,60}$/.test(key) ||
        ['message', 'code', 'status', 'timestamp'].includes(key)
      )
        continue;
      result[key] = key.toLowerCase().includes('email')
        ? 'Revisá el formato del email e intentá nuevamente.'
        : key.toLowerCase().includes('pass')
          ? 'Revisá este dato e intentá nuevamente.'
          : 'Revisá este campo e intentá nuevamente.';
    }
    return result;
  }

  private safeConflictMessage(body: unknown): string {
    if (body && typeof body === 'object') {
      const candidate = (body as { code?: unknown }).code;
      if (candidate === 'EMAIL_ALREADY_EXISTS') return 'Este email ya está registrado.';
      if (candidate === 'SLOT_UNAVAILABLE') return 'Ese horario ya no está disponible. Elegí otro.';
    }
    if (typeof body === 'string') {
      const safeBody = body.toLowerCase();
      if (/email.{0,30}(registrad|exist)|ya existe.{0,20}email/.test(safeBody))
        return 'Este email ya está registrado.';
      if (/horario.{0,30}(ocupad|disponible)|turno.{0,30}(ocupad|disponible)/.test(safeBody))
        return 'Ese horario ya no está disponible. Elegí otro.';
    }
    return 'No se pudo completar esta acción porque hay un conflicto. Revisá los datos e intentá nuevamente.';
  }
}


// Errores HTTP que se muestran en la interfaz

export const apiErrorInterceptor: HttpInterceptorFn = (request, next) => {
  // La pantalla que marcó la petición resuelve el error inline y ofrece su
  // propio reintento; el interceptor no debe navegar ni duplicar el aviso.
  if (request.context.get(SIN_MANEJO_GLOBAL_DE_ERRORES)) return next(request);

  const errors = inject(apiErrorsService);
  const router = inject(Router);
  const auth = inject(authService);
  const navigation = router.getCurrentNavigation();
  const attemptedUrl = navigation?.finalUrl ?? navigation?.extractedUrl;
  const requestOrigin = attemptedUrl ? router.serializeUrl(attemptedUrl) : router.url;

  return next(request).pipe(
    catchError((cause: unknown) => {
      if (!(cause instanceof HttpErrorResponse)) return throwError(() => cause);

      const error = errors.map(cause);

      // El guard decide qué hacer con la validación de sesión. El listado y
      // el detalle ya muestran sus propios errores de carga y reintentos.
      const path = new URL(request.url, globalThis.location.origin).pathname;
      const validacionDeSesion = path.endsWith('/usuarios/me');
      const cargaDeSucursales = request.method === 'GET'
        && /\/sucursales(?:\/|$)/.test(path)
        && [0, 500, 502, 503].includes(cause.status);

      if (validacionDeSesion || cargaDeSucursales) {
        return throwError(() => error);
      }
      const isLogin =
        request.url.includes('/usuarios/inicio-sesion') || request.url.includes('/auth/');

      if (cause.status === 401 && !isLogin) {
        auth.limpiarSesion();
        const activeUrl = router.getCurrentNavigation()?.finalUrl;
        const currentUrl = activeUrl ? router.serializeUrl(activeUrl) : router.url;
        const returnTo = currentUrl.startsWith('/login') || currentUrl.startsWith('/error') ? '/' : currentUrl;
        void router.navigate(['/login'], { queryParams: { returnTo, expired: '1' } });
      } else if (![400, 401, 422].includes(cause.status) && !isLogin) {
        if (![0, 403, 404, 409, 429, 500, 502, 503].includes(cause.status)) {
          void router.navigate(['/error'], {
            state: { status: cause.status, errorReference: error.reference },
          });
        } else {
          const canRetry = [500, 502, 503].includes(cause.status);
          if ((canRetry || cause.status === 0) && request.method === 'GET') {
            const currentUrl = requestOrigin;
            void router.navigate(['/error'], {
              state: { status: cause.status, errorReference: error.reference, returnTo: currentUrl },
              replaceUrl: true,
            });
            return throwError(() => error);
          }
          const retry: (() => void) | undefined = canRetry
            ? () => {
              const current = errors.notice();
              if (current?.retrying) return;
              errors.notice.update((notice) => (notice ? { ...notice, retrying: true } : notice));
              void next(request).subscribe({
                next: () => errors.dismiss(),
                error: (retryCause: HttpErrorResponse) => {
                  const retryError = errors.map(retryCause);
                  errors.notice.set({ error: retryError, retry, retrying: false });
                },
              });
            }
            : undefined;
          errors.notice.set({ error, retry });
        }
      }

      return throwError(() => error);
    }),
  );
};
