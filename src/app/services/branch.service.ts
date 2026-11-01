import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from '../auth/auth';
import { BranchCategory, BranchFilters, BranchSummary } from '../models/branch';

@Injectable({ providedIn: 'root' })
export class BranchService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${API_URL}/sucursales`;

  list(filters: BranchFilters = {}): Observable<readonly BranchSummary[]> {
    const hasFilters = !!filters.nombre || !!filters.categoria;
    const url = hasFilters ? `${this.apiUrl}/listar/filtrar` : `${this.apiUrl}/listar`;
    let params = new HttpParams();

    if (filters.nombre) {
      params = params.set('nombre', filters.nombre.trim());
    }

    if (filters.categoria) {
      params = params.set('categoria', filters.categoria);
    }

    return this.http.get<readonly BranchSummary[]>(url, { params });
  }

  getCategories(): Observable<readonly BranchCategory[]> {
    return this.http.get<readonly BranchCategory[]>(`${this.apiUrl}/categorias`);
  }
}
