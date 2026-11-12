import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { EmpleadoDTO } from '../models/empleado';
import { backendService } from './backend-service';
import { SIN_MANEJO_GLOBAL_DE_ERRORES } from '../http/error-handling-context';

/** Acceso HTTP a empleados asociados a una sucursal y a sus operaciones de gestión. */

@Injectable({ providedIn: 'root' })
export class empleadoService {
  private readonly api = inject(backendService);
  private readonly http = inject(HttpClient);

  /** Lista los profesionales disponibles para reservar en la sucursal indicada. */
  listarPorSucursal(sucursalId: number): Observable<EmpleadoDTO[]> {
    return this.http.get<EmpleadoDTO[]>(
      `${this.api.baseUrl}/sucursales/${sucursalId}/elegir-empleado`,
      { context: new HttpContext().set(SIN_MANEJO_GLOBAL_DE_ERRORES, true) },
    );
  }

  /** Crea un empleado asociado a la sucursal; la autorización la valida el backend. */
  crear(
    sucursalId: number,
    datos: { nombre: string; apellido: string; urlFotoPerfil: string | null },
  ): Observable<EmpleadoDTO> {
    return this.http.post<EmpleadoDTO>(
      `${this.api.baseUrl}/sucursales/${sucursalId}/empleados`,
      datos,
    );
  }

  /** Actualiza los datos básicos de un empleado de la sucursal. */
  actualizar(
    sucursalId: number,
    empleadoId: number,
    datos: { nombre: string; apellido: string; urlFotoPerfil: string | null },
  ): Observable<EmpleadoDTO> {
    return this.http.put<EmpleadoDTO>(
      `${this.api.baseUrl}/sucursales/${sucursalId}/empleados/${empleadoId}`,
      datos,
    );
  }

  /** Solicita la baja de un empleado en la sucursal. */
  eliminar(sucursalId: number, empleadoId: number): Observable<void> {
    return this.http
      .delete(
        `${this.api.baseUrl}/sucursales/${sucursalId}/empleados/eliminar/${empleadoId}`,
        {
          observe: 'response',
          responseType: 'text',
          context: new HttpContext().set(SIN_MANEJO_GLOBAL_DE_ERRORES, true),
        },
      )
      .pipe(map(() => undefined));
  }
}
