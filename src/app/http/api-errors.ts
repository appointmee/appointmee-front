import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { authService } from '../services/auth-service';

export interface ApiError {
  readonly status: number;
  readonly message: string;
  readonly fields: Readonly<Record<string, string>>;
  readonly reference: string;
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

@Injectable({ providedIn: 'root' })
export class ApiErrors {
  readonly notice = signal<{ error: ApiError } | null>(null);

  map(response: HttpErrorResponse): ApiError {
    const reference = crypto.randomUUID();
    const conflictCode = response.error && typeof response.error === 'object'
      ? (response.error as { code?: unknown }).code
      : undefined;
    const conflictText = typeof response.error === 'string' ? response.error.toLowerCase() : '';
    const duplicateEmail = conflictCode === 'EMAIL_ALREADY_EXISTS'
      || /email.{0,30}(registrad|exist)|ya existe.{0,20}email/.test(conflictText);
    const fields = response.status === 400 || response.status === 422
      ? this.fieldErrors(response.error)
      : response.status === 409 && duplicateEmail
        ? { email: 'Este email ya está registrado.' }
        : {};
    const message = response.status === 409
      ? this.safeConflictMessage(response.error)
      : SAFE_MESSAGES[response.status] ?? 'Ocurrió un error inesperado. Volvé al inicio e intentá nuevamente.';

    return { status: response.status, message, fields, reference };
  }

  dismiss(): void { this.notice.set(null); }

  private fieldErrors(body: unknown): Record<string, string> {
    if (!body || typeof body !== 'object') return {};
    const record = body as Record<string, unknown>;
    const candidate = record['fields'] && typeof record['fields'] === 'object'
      ? record['fields'] as Record<string, unknown>
      : record;
    const result: Record<string, string> = {};
    for (const key of Object.keys(candidate)) {
      if (!/^[A-Za-z][A-Za-z0-9_.-]{0,60}$/.test(key) || ['message', 'code', 'status', 'timestamp'].includes(key)) continue;
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
      if (/email.{0,30}(registrad|exist)|ya existe.{0,20}email/.test(safeBody)) return 'Este email ya está registrado.';
      if (/horario.{0,30}(ocupad|disponible)|turno.{0,30}(ocupad|disponible)/.test(safeBody)) return 'Ese horario ya no está disponible. Elegí otro.';
    }
    return 'No se pudo completar esta acción porque hay un conflicto. Revisá los datos e intentá nuevamente.';
  }
}

export const apiErrorInterceptor: HttpInterceptorFn = (request, next) => {
  const errors = inject(ApiErrors);
  const router = inject(Router);
  const auth = inject(authService);
  return next(request).pipe(catchError((cause: unknown) => {
    if (!(cause instanceof HttpErrorResponse)) return throwError(() => cause);
    const error = errors.map(cause);
    const isLogin = request.url.includes('/usuarios/inicio-sesion');

    if (cause.status === 401 && !isLogin) {
      auth.limpiarSesion();
      const returnTo = router.url.startsWith('/login') || router.url.startsWith('/error') ? '/' : router.url;
      void router.navigate(['/login'], { queryParams: { returnTo, expired: '1' } });
    } else if (cause.status !== 400 && cause.status !== 422 && !isLogin) {
      const retryableRead = request.method === 'GET' && [500, 502, 503].includes(cause.status);
      if (retryableRead) {
        const returnTo = router.url.startsWith('/error') ? '/' : router.url;
        void router.navigate(['/error'], {
          state: { status: cause.status, errorReference: error.reference, returnTo },
          replaceUrl: true,
        });
      } else if (![0, 403, 404, 409, 429, 500, 502, 503].includes(cause.status)) {
        // Los errores de operaciones que pueden modificar datos se quedan en
        // el formulario para evitar perderlo o repetir una acción no idempotente.
        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
          errors.notice.set({ error });
        } else {
          void router.navigate(['/error'], {
            state: { status: cause.status, errorReference: error.reference },
            replaceUrl: true,
          });
        }
      } else {
        errors.notice.set({ error });
      }
    }

    return throwError(() => error);
  }));
};
