import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { EliminarSucursal } from './eliminar-sucursal';

describe('EliminarSucursal', () => {
  let fixture: ComponentFixture<EliminarSucursal>;
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EliminarSucursal],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(EliminarSucursal);
    fixture.detectChanges();
  });
  it('crea el componente', () => expect(fixture.componentInstance).toBeTruthy());
});
