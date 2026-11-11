import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { SIN_MANEJO_GLOBAL_DE_ERRORES } from '../http/error-handling-context';
import { backendService } from './backend-service';

@Injectable({ providedIn: 'root' })
export class pagoService {
  private http = inject(HttpClient);
  private api = inject(backendService);

  /**
   * Solicita al backend la creación de la preferencia de pago de Mercado Pago
   * para un turno ya registrado. Devuelve la URL (init_point) a abrir.
   */
  crearPreferencia(turnoId: number): Observable<string> {
    return this.http.post(`${this.api.baseUrl}/pagos/${turnoId}`, null, {
      context: new HttpContext().set(SIN_MANEJO_GLOBAL_DE_ERRORES, true),
      responseType: 'text',
    });
  }
}