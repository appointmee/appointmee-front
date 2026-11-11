import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { AgregarmeEmpleado } from './agregarme-empleado';

describe('AgregarmeEmpleado', () => {
  let fixture: ComponentFixture<AgregarmeEmpleado>;
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AgregarmeEmpleado],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(AgregarmeEmpleado);
    fixture.detectChanges();
  });
  it('crea el componente', () => expect(fixture.componentInstance).toBeTruthy());
});
