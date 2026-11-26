import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SolicitudEmpleadorDetalleDTO } from '../../models/solicitud-empleador';
import { SolicitudEmpleadorDetalle } from './solicitud-empleador-detalle';

const DETALLE: SolicitudEmpleadorDetalleDTO = {
  id: 42,
  motivo: 'Quiero publicar mis sucursales en AppointMee.',
  estado: 'PENDIENTE',
  fechaSolicitud: '2026-11-01',
  usuario: {
    id: 1,
    nombre: 'Ana',
    apellido: 'Pérez',
    email: 'ana@example.com',
    urlFotoPerfil: null,
  },
  ubicaciones: [
    {
      id: 7,
      direccion: '25 de Mayo 2423, B7600GWE Mar del Plata, Provincia de Buenos Aires, Argentina',
      latitud: -34.6037,
      longitud: -58.3816,
      googlePlaceId: 'ChIJ_corientes',
    },
    {
      id: 8,
      direccion: 'Av. Santa Fe 3253, CABA, Argentina',
      latitud: -34.5889,
      longitud: -58.3951,
      googlePlaceId: '',
    },
    {
      id: 9,
      direccion:
        'GTC, Av. Pedro Luro 2335, B7600GWE Mar del Plata, Provincia de Buenos Aires, Argentina',
      latitud: -38.0056,
      longitud: -57.5426,
      googlePlaceId: 'ChIJ_luro',
    },
  ],
};

describe('SolicitudEmpleadorDetalle', () => {
  let fixture: ComponentFixture<SolicitudEmpleadorDetalle>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SolicitudEmpleadorDetalle],
    }).compileComponents();

    fixture = TestBed.createComponent(SolicitudEmpleadorDetalle);
    fixture.componentRef.setInput('detalle', DETALLE);
    fixture.detectChanges();
  });

  afterEach(() => fixture.destroy());

  it('en la vista del usuario muestra solo el título genérico, sin número ni subtítulo', () => {
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('h3')?.textContent?.trim()).toBe('Detalles de la solicitud');
    expect(host.textContent).not.toContain('Solicitud #');
    expect(host.querySelector('.detalle__eyebrow')).toBeNull();
  });

  it('en el panel administrador conserva el subtítulo y el número de solicitud', () => {
    fixture.componentRef.setInput('modo', 'admin');
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('.detalle__eyebrow')?.textContent?.trim()).toBe(
      'Detalle de la solicitud',
    );
    expect(host.querySelector('h3')?.textContent?.trim()).toBe('Solicitud #42');
  });

  it('muestra las ubicaciones guardadas con enlaces públicos de Google Maps', () => {
    const host = fixture.nativeElement as HTMLElement;
    const filas = host.querySelectorAll<HTMLElement>('.detalle__ubicacion');
    const enlaces = host.querySelectorAll<HTMLAnchorElement>('.detalle__ubicacion-mapa');

    expect(filas).toHaveLength(3);
    expect(
      filas[0].querySelector('.detalle__ubicacion-direccion')?.textContent?.trim(),
    ).toBe('25 de Mayo 2423, Mar del Plata');
    expect(filas[0].textContent).not.toContain('B7600GWE');
    expect(filas[0].textContent).not.toContain('Provincia de Buenos Aires');
    expect(filas[0].textContent).not.toContain('Argentina');
    expect(
      filas[1].querySelector('.detalle__ubicacion-direccion')?.textContent?.trim(),
    ).toBe('Av. Santa Fe 3253, CABA');
    expect(
      filas[2].querySelector('.detalle__ubicacion-direccion')?.textContent?.trim(),
    ).toBe('Av. Pedro Luro 2335, Mar del Plata');
    expect(filas[2].textContent).not.toContain('GTC');
    expect(filas[2].textContent).not.toContain('B7600GWE');
    expect(filas[2].textContent).not.toContain('Provincia de Buenos Aires');
    expect(enlaces).toHaveLength(3);

    const primera = new URL(enlaces[0].href);
    expect(primera.origin).toBe('https://www.google.com');
    expect(primera.pathname).toBe('/maps/search/');
    expect(primera.searchParams.get('api')).toBe('1');
    expect(primera.searchParams.get('query')).toBe('-34.6037,-58.3816');
    expect(primera.searchParams.get('query_place_id')).toBe('ChIJ_corientes');
    expect(enlaces[0].target).toBe('_blank');
    expect(enlaces[0].rel).toContain('noopener');

    const segunda = new URL(enlaces[1].href);
    expect(segunda.searchParams.get('query')).toBe(DETALLE.ubicaciones![1].direccion);
    expect(segunda.searchParams.has('query_place_id')).toBe(false);
  });

  it('avisa cuando una solicitud histórica no tiene ubicaciones', () => {
    fixture.componentRef.setInput('detalle', { ...DETALLE, ubicaciones: [] });
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('Esta solicitud no tiene ubicaciones registradas.');
    expect(host.querySelector('.detalle__ubicacion')).toBeNull();
  });

  it('muestra la dirección original cuando no puede identificar la calle con seguridad', () => {
    const ubicacion = {
      id: 10,
      direccion: 'Argentina',
      latitud: -34.6037,
      longitud: -58.3816,
      googlePlaceId: 'ChIJ_fallback',
    };
    fixture.componentRef.setInput('detalle', { ...DETALLE, ubicaciones: [ubicacion] });
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(
      host.querySelector('.detalle__ubicacion-direccion')?.textContent?.trim(),
    ).toBe('Argentina');

    fixture.componentRef.setInput('detalle', {
      ...DETALLE,
      ubicaciones: [{ ...ubicacion, direccion: 'B7600GWE Mar del Plata' }],
    });
    fixture.detectChanges();
    expect(
      host.querySelector('.detalle__ubicacion-direccion')?.textContent?.trim(),
    ).toBe('B7600GWE Mar del Plata');
  });

  it('conserva calles compuestas y no inventa altura cuando no está disponible', () => {
    fixture.componentRef.setInput('detalle', {
      ...DETALLE,
      ubicaciones: [
        {
          id: 11,
          direccion:
            'Av. Brigadier General Juan B. Justo, B7600GWE Mar del Plata, Provincia de Buenos Aires, Argentina',
          latitud: -38.0056,
          longitud: -57.5426,
          googlePlaceId: 'ChIJ_compuesta',
        },
      ],
    });
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(
      host.querySelector('.detalle__ubicacion-direccion')?.textContent?.trim(),
    ).toBe('Av. Brigadier General Juan B. Justo, Mar del Plata');
    expect(new URL(host.querySelector<HTMLAnchorElement>('.detalle__ubicacion-mapa')!.href).searchParams.get('query_place_id')).toBe(
      'ChIJ_compuesta',
    );
  });

  it('quita el nombre del establecimiento cuando no hay ciudad en la dirección guardada', () => {
    fixture.componentRef.setInput('detalle', {
      ...DETALLE,
      ubicaciones: [
        {
          id: 12,
          direccion: 'GTC, Av. Pedro Luro 2335',
          latitud: -38.0056,
          longitud: -57.5426,
          googlePlaceId: 'ChIJ_sin_ciudad',
        },
      ],
    });
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(
      host.querySelector('.detalle__ubicacion-direccion')?.textContent?.trim(),
    ).toBe('Av. Pedro Luro 2335');
  });
});
