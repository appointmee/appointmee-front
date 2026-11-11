import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { EliminarEmpleado } from './eliminar-empleado';

describe('EliminarEmpleado', () => {
  let fixture: ComponentFixture<EliminarEmpleado>;
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EliminarEmpleado],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(EliminarEmpleado);
    fixture.detectChanges();
  });
  it('crea el componente', () => expect(fixture.componentInstance).toBeTruthy());
});
