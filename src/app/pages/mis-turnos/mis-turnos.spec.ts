import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { MisTurnos } from './mis-turnos';

describe('MisTurnos', () => {
  let fixture: ComponentFixture<MisTurnos>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MisTurnos],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(MisTurnos);
    fixture.detectChanges();
  });

  it('crea el componente', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('muestra estado de carga inicial', () => {
    expect(fixture.nativeElement.textContent).toContain('Cargando');
  });
});
