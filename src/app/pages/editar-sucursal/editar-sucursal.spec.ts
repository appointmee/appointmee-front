import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { EditarSucursal } from './editar-sucursal';

describe('EditarSucursal', () => {
  let fixture: ComponentFixture<EditarSucursal>;
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditarSucursal],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(EditarSucursal);
    fixture.detectChanges();
  });
  it('crea el componente', () => expect(fixture.componentInstance).toBeTruthy());
});
