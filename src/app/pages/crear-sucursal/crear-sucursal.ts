import { DsButtonComponent } from '../../shared/ui/button/button.component';
import { DsInputComponent } from '../../shared/ui/input/input.component';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormField, form, required } from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';

import { SucursalPayload } from '../../models/sucursal';
import { sucursalService } from '../../services/sucursal-service';

interface CrearSucursalModel {
  nombre: string;
  direccion: string;
  telefono: string;
  descripcion: string;
  categoria: string;
  horaApertura: string;
  horaCierre: string;
}

@Component({
  selector: 'app-crear-sucursal',
  imports: [DsButtonComponent, DsInputComponent, FormField, RouterLink],
  templateUrl: './crear-sucursal.html',
  styleUrl: './crear-sucursal.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CrearSucursalPage {
  private readonly api = inject(sucursalService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  cargando = signal(false);
  error = signal<string | null>(null);
  exito = signal<string | null>(null);

  model = signal<CrearSucursalModel>({
    nombre: '',
    direccion: '',
    telefono: '',
    descripcion: '',
    categoria: '',
    horaApertura: '',
    horaCierre: '',
  });

  formulario = form(this.model, (campos) => {
    required(campos.nombre, { message: 'Ingresá el nombre de la sucursal.' });
  });

  onSubmit(event: Event): void {
    event.preventDefault();
    if (this.cargando()) return;
    this.formulario().markAsTouched();
    if (this.formulario().invalid()) {
      this.formulario.nombre().focusBoundControl();
      return;
    }

    this.cargando.set(true);
    this.error.set(null);
    this.exito.set(null);

    const datos: SucursalPayload = {
      nombre: this.model().nombre.trim(),
      direccion: this.model().direccion.trim() || null,
      telefono: this.model().telefono.trim() || null,
      descripcion: this.model().descripcion.trim() || null,
      categoria: this.model().categoria.trim() || null,
      horaApertura: this.model().horaApertura.trim() || null,
      horaCierre: this.model().horaCierre.trim() || null,
      diasApertura: null,
      fotoPerfil: null,
    };

    this.api
      .crear(datos)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.cargando.set(false);
          this.exito.set('Sucursal creada correctamente.');
          void this.router.navigateByUrl('/mis-sucursales');
        },
        error: () => {
          this.cargando.set(false);
          this.error.set('No pudimos crear la sucursal. Intentá de nuevo.');
        },
      });
  }
}
