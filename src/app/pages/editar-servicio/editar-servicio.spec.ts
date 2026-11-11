import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { EditarServicio } from './editar-servicio';

describe('EditarServicio', () => {
  let fixture: ComponentFixture<EditarServicio>;
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditarServicio],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(EditarServicio);
    fixture.detectChanges();
  });
  it('crea el componente', () => expect(fixture.componentInstance).toBeTruthy());
});
