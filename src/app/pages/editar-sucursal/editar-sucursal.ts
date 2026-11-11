import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormField, form, maxLength, minLength, pattern, required } from '@angular/forms/signals';
import { ActivatedRoute, Router } from '@angular/router';

import { DsButtonComponent } from '../../shared/ui/button/button.component';
import { DsInputComponent } from '../../shared/ui/input/input.component';
import { SucursalDetalleDTO, SucursalPayload } from '../../models/sucursal';
import { sucursalService } from '../../services/sucursal-service';

interface EditarSucursalModel {
  nombre: string;
  direccion: string;
  telefono: string;
  descripcion: string;
  horaApertura: string;
  horaCierre: string;
  fotoPerfil: string;
}

@Component({
  selector: 'app-editar-sucursal',
  imports: [DsButtonComponent, DsInputComponent, FormField],
  templateUrl: './editar-sucursal.html',
  styleUrl: '../crear-sucursal/crear-sucursal.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditarSucursalPage {
  private readonly api = inject(sucursalService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly sucursalId = this.parseId(this.route.snapshot.paramMap.get('sucursalId'));
  readonly modeloInicial: EditarSucursalModel = {
    nombre: '', direccion: '', telefono: '', descripcion: '',
    horaApertura: '', horaCierre: '', fotoPerfil: '',
  };

  readonly model = signal<EditarSucursalModel>(this.modeloInicial);
  readonly original = signal<EditarSucursalModel | null>(null);
  readonly cargandoDatos = signal(true);
  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);
  readonly exito = signal<string | null>(null);
  readonly confirmarDescarte = signal(false);

  readonly formulario = form(this.model, campos => {
    required(campos.nombre, { message: 'Ingresá el nombre de la sucursal.' });
    minLength(campos.nombre, 4, { message: 'Usá al menos 4 caracteres.' });
    maxLength(campos.nombre, 120, { message: 'Usá como máximo 120 caracteres.' });
    required(campos.direccion, { message: 'Ingresá la dirección.' });
    minLength(campos.direccion, 10, { message: 'La dirección debe tener al menos 10 caracteres.' });
    maxLength(campos.direccion, 80, { message: 'La dirección no puede superar 80 caracteres.' });
    minLength(campos.telefono, 8, { message: 'El teléfono debe tener al menos 8 dígitos.' });
    maxLength(campos.telefono, 20, { message: 'El teléfono no puede superar 20 dígitos.' });
    pattern(campos.telefono, /^\d*$/, { message: 'El teléfono solo puede contener números.' });
    required(campos.descripcion, { message: 'Ingresá una descripción.' });
    minLength(campos.descripcion, 10, { message: 'La descripción debe tener al menos 10 caracteres.' });
    maxLength(campos.descripcion, 255, { message: 'La descripción no puede superar 255 caracteres.' });
  });

  constructor() {
    if (this.sucursalId === null) {
      this.cargandoDatos.set(false);
      this.error.set('No se pudo identificar la sucursal.');
      return;
    }
    this.cargar();
  }

  cargar(): void {
    if (this.cargandoDatos() && this.sucursalId === null) return;
    if (this.sucursalId === null) return;
    this.cargandoDatos.set(true);
    this.error.set(null);
    this.api.obtenerPorId(this.sucursalId, true).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (sucursal: SucursalDetalleDTO) => {
        const datos: EditarSucursalModel = {
          nombre: sucursal.nombre ?? '',
          direccion: sucursal.direccion ?? '',
          telefono: sucursal.telefono ?? '',
          descripcion: sucursal.descripcion ?? '',
          horaApertura: sucursal.horaApertura ?? '',
          horaCierre: sucursal.horaCierre ?? '',
          fotoPerfil: sucursal.fotoPerfil ?? '',
        };
        this.model.set(datos);
        this.original.set(datos);
        this.cargandoDatos.set(false);
      },
      error: () => {
        this.cargandoDatos.set(false);
        this.error.set('No pudimos cargar la sucursal. Revisá tu conexión e intentá nuevamente.');
      },
    });
  }

  hayCambios(): boolean {
    return !!this.original() && JSON.stringify(this.original()) !== JSON.stringify(this.model());
  }

  onSubmit(event: Event): void {
    event.preventDefault();
    if (this.cargando() || this.sucursalId === null) return;
    this.formulario().markAsTouched();
    if (this.formulario().invalid()) {
      const primero = [this.formulario.nombre, this.formulario.direccion,
        this.formulario.telefono, this.formulario.descripcion]
        .find(campo => campo().invalid());
      primero?.().focusBoundControl();
      return;
    }

    this.cargando.set(true);
    this.error.set(null);
    this.exito.set(null);
    const valor = this.model();
    const payload: SucursalPayload = {
      nombre: valor.nombre.trim(),
      direccion: valor.direccion.trim(),
      telefono: valor.telefono.trim() || null,
      descripcion: valor.descripcion.trim(),
      categoria: null,
      horaApertura: valor.horaApertura || null,
      horaCierre: valor.horaCierre || null,
      diasApertura: null,
      fotoPerfil: valor.fotoPerfil.trim() || null,
    };
    this.api.actualizar(this.sucursalId, payload).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.cargando.set(false);
        this.exito.set('Sucursal actualizada correctamente.');
        this.original.set(this.model());
      },
      error: () => {
        this.cargando.set(false);
        this.error.set('No pudimos guardar los cambios. Revisá los datos e intentá nuevamente.');
      },
    });
  }

  cancelar(): void {
    if (this.hayCambios()) this.confirmarDescarte.set(true);
    else this.volver();
  }

  confirmarDescartar(): void {
    this.confirmarDescarte.set(false);
    this.volver();
  }

  private volver(): void {
    void this.router.navigateByUrl('/mis-sucursales');
  }

  private parseId(value: string | null): number | null {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
  }
}
