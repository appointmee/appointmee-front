import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, of, timeout } from 'rxjs';
import { backendService } from '../../services/backend-service';
import { SIN_MANEJO_GLOBAL_DE_ERRORES } from '../../http/error-handling-context';

export interface ErrorObservation {
  readonly screen: 'error';
  readonly reference: string | null;
  readonly code: string;
  readonly status: number | null;
}

@Injectable({ providedIn: 'root' })
export class ReporteError {
  private readonly http = inject(HttpClient);
  private readonly backend = inject(backendService);

  registrar(error: { readonly code: string; readonly status: number | null }, reference: string | null): void {
    const evento: ErrorObservation = {
      screen: 'error',
      reference,
      code: error.code,
      status: error.status,
    };

    this.http.post(`${this.backend.baseUrl}/observabilidad/error`, evento, {
      context: new HttpContext().set(SIN_MANEJO_GLOBAL_DE_ERRORES, true),
    }).pipe(timeout(3000), catchError(() => of(null))).subscribe();
  }
}
