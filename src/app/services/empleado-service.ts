import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { EmpleadoDTO } from '../models/empleado';
import { backendService } from './backend-service';
import { SIN_MANEJO_GLOBAL_DE_ERRORES } from '../http/error-handling-context';

/**
 *  Crud de Empleado/Profesional
 */

@Injectable({ providedIn: 'root' })
export class empleadoService {
  private readonly api = inject(backendService);
  private readonly http = inject(HttpClient);

  //GET
  listarPorSucursal(sucursalId: number): Observable<EmpleadoDTO[]> {
    return this.http.get<EmpleadoDTO[]>(
      `${this.api.baseUrl}/sucursales/${sucursalId}/elegir-empleado`,
      { context: new HttpContext().set(SIN_MANEJO_GLOBAL_DE_ERRORES, true) },
    );
  }

  //POST
  crear(
    sucursalId: number,
    datos: { nombre: string; apellido: string; urlFotoPerfil: string | null },
  ): Observable<EmpleadoDTO> {
    return this.http.post<EmpleadoDTO>(
      `${this.api.baseUrl}/sucursales/${sucursalId}/empleados`,
      datos,
    );
  }

  //PUT
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

  //DELETE
  eliminar(sucursalId: number, empleadoId: number): Observable<string> {
    return this.http.delete(
      `${this.api.baseUrl}/sucursales/${sucursalId}/empleados/eliminar/${empleadoId}`,
      {
        responseType: 'text',
        context: new HttpContext().set(SIN_MANEJO_GLOBAL_DE_ERRORES, true),
      },
    );
  }
}
