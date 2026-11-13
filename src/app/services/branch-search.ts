import { Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, filter, map, merge, tap } from 'rxjs';

function normalizeTerm(value: string): string {
  return value.trim();
}

function isValidTerm(value: string): boolean {
  return value.length === 0 || value.length >= 2;
}

/**
 * Centraliza el texto del buscador de sucursales: espera 350 ms al escribir,
 * permite confirmar antes con Enter y conserva los demás filtros de la URL.
 */
@Injectable({ providedIn: 'root' })
export class BranchSearch {
  private readonly router = inject(Router);
  private readonly submitted = new Subject<string>();

  readonly search = new FormControl('', { nonNullable: true });
  readonly term = signal('');
  readonly termTooShort = signal(false);

  constructor() {
    merge(
      this.search.valueChanges.pipe(
        tap((value) => {
          this.term.set(value);
          this.termTooShort.set(normalizeTerm(value).length === 1);
        }),
        debounceTime(350),
      ),
      this.submitted,
    )
      .pipe(
        map(normalizeTerm),
        filter(isValidTerm),
        distinctUntilChanged(),
        takeUntilDestroyed(),
      )
      .subscribe((term) => {
        void this.router.navigate(['/sucursales'], {
          queryParams: { busqueda: term || null },
          queryParamsHandling: 'merge',
        });
      });
  }

  /** Confirma de inmediato el término actual sin esperar el debounce. */
  submit(): void {
    const term = normalizeTerm(this.search.value);
    this.term.set(this.search.value);
    this.termTooShort.set(term.length === 1);
    this.submitted.next(term);
  }

  /** Vacía el campo y quita `busqueda` de la URL sin modificar otros filtros. */
  clear(): void {
    this.search.setValue('', { emitEvent: false });
    this.term.set('');
    this.termTooShort.set(false);
    this.submitted.next('');
  }
}
