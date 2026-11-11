import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { VerEmpleados } from './ver-empleados';

describe('VerEmpleados', () => {
  let fixture: ComponentFixture<VerEmpleados>;
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VerEmpleados],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(VerEmpleados);
    fixture.detectChanges();
  });
  it('crea el componente', () => expect(fixture.componentInstance).toBeTruthy());
});
