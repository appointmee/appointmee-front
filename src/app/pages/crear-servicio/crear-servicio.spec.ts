import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { CrearServicio } from './crear-servicio';

describe('CrearServicio', () => {
  let fixture: ComponentFixture<CrearServicio>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CrearServicio],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(CrearServicio);
    fixture.detectChanges();
  });

  it('crea el componente', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('valida campos obligatorios', () => {
    (fixture.componentInstance as any).guardar();
    expect((fixture.componentInstance as any).error()).toContain('Revisá');
  });
});
