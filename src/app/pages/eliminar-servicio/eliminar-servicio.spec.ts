import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { EliminarServicio } from './eliminar-servicio';

describe('EliminarServicio', () => {
  let fixture: ComponentFixture<EliminarServicio>;
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EliminarServicio],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(EliminarServicio);
    fixture.detectChanges();
  });
  it('crea el componente', () => expect(fixture.componentInstance).toBeTruthy());
});
