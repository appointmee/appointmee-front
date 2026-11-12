import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';

import { SucursalMiniDTO } from '../../models/sucursal';
import { UsuarioPerfilDTO } from '../../models/usuario';
import { authService } from '../../services/auth-service';
import { Perfil } from './perfil';

type SesionMock = {
  id: number;
  email: string | null;
  roles: readonly string[];
  fotoPerfil: string | null;
};

const PERFIL: UsuarioPerfilDTO = {
  id: 42,
  nombre: 'Ana',
  apellido: 'Pérez',
  email: 'ana@example.com',
  fechaCreacion: '2024-01-15',
  fotoPerfil: null,
  roles: ['EMPLEADO'],
  sucursalesEmpleado: [],
};

function perfil(overrides: Partial<UsuarioPerfilDTO> = {}): UsuarioPerfilDTO {
  return { ...PERFIL, ...overrides };
}

function sucursal(
  id: number,
  nombre: string,
  overrides: Partial<SucursalMiniDTO> = {},
): SucursalMiniDTO {
  return {
    id,
    nombre,
    categoria: 'CAFE',
    fotoPerfil: null,
    puntuacion: null,
    cantidadPuntuaciones: 0,
    ...overrides,
  };
}

function texto(host: HTMLElement): string {
  return (host.textContent ?? '').replace(/\s+/g, ' ').trim();
}

describe('US-PER-02 · Ver el perfil del usuario autenticado', () => {
  let fixture: ComponentFixture<Perfil>;
  let backend: HttpTestingController;
  let sesion: SesionMock;
  const auth = { perfil: () => sesion };
  const title = { setTitle: vi.fn() };

  beforeEach(async () => {
    sesion = {
      id: 42,
      email: 'ana@example.com',
      roles: ['EMPLEADO'],
      fotoPerfil: null,
    };
    title.setTitle.mockClear();

    await TestBed.configureTestingModule({
      imports: [Perfil],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: authService, useValue: auth },
        { provide: Title, useValue: title },
      ],
    }).compileComponents();

    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    fixture?.destroy();
    backend.verify();
  });

  function crear(): void {
    fixture = TestBed.createComponent(Perfil);
    fixture.detectChanges();
  }

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function responderPerfil(datos: UsuarioPerfilDTO): void {
    backend.expectOne((request) => request.url.endsWith('/usuarios/42')).flush(datos);
    fixture.detectChanges();
  }

  function fallarPerfil(status: number): void {
    backend
      .expectOne((request) => request.url.endsWith('/usuarios/42'))
      .flush({}, { status, statusText: status === 0 ? 'Unknown Error' : 'Server Error' });
    fixture.detectChanges();
  }

  function responderPropias(sucursales: readonly SucursalMiniDTO[]): void {
    backend
      .expectOne((request) => request.url.endsWith('/sucursales/listar/propias'))
      .flush(sucursales);
    fixture.detectChanges();
  }

  function paneles(): readonly [HTMLElement, HTMLElement] {
    const encontrados = host().querySelectorAll<HTMLElement>('.panel');
    expect(encontrados).toHaveLength(2);
    return [encontrados[0], encontrados[1]];
  }

  it('muestra un skeleton accesible mientras carga el perfil', () => {
    crear();

    expect(host().querySelector('.perfil__inner--skeleton')).not.toBeNull();
    expect(host().querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(texto(host())).toContain('Cargando la información de tu perfil');

    responderPerfil(perfil());

    expect(host().querySelector('.perfil__inner--skeleton')).toBeNull();
  });

  it('muestra los datos personales y separa las sucursales por rol sin duplicados', () => {
    sesion.roles = ['EMPLEADO', 'EMPLEADOR'];
    const norte = sucursal(111, 'Sucursal Norte', {
      categoria: 'PELUQUERIA',
      puntuacion: 4.5,
      cantidadPuntuaciones: 12,
    });
    const centro = sucursal(222, 'Sucursal Centro');
    const sur = sucursal(333, 'Sucursal Sur', { categoria: 'GIMNASIO' });
    const este = sucursal(444, 'Sucursal Este', { categoria: 'VETERINARIA' });

    crear();
    responderPerfil(
      perfil({
        roles: ['EMPLEADO', 'EMPLEADOR'],
        sucursalesEmpleado: [norte, centro, sur],
      }),
    );
    responderPropias([centro, este]);

    const [empleado, empleador] = paneles();
    const textoEmpleado = texto(empleado);
    const textoEmpleador = texto(empleador);

    expect(texto(host())).toContain('Ana Pérez');
    expect(texto(host())).toContain('ana@example.com');
    expect(texto(host())).toContain('2024');
    expect(
      [...host().querySelectorAll('.perfil__roles li')].map((rol) => rol.textContent?.trim()),
    ).toEqual(['Empleado', 'Empleador']);

    expect(textoEmpleado).toContain('Sucursal Norte');
    expect(textoEmpleado).toContain('Sucursal Sur');
    expect(textoEmpleado).not.toContain('Sucursal Centro');
    expect(textoEmpleado).not.toContain('Sucursal Este');

    expect(textoEmpleador).toContain('Sucursal Centro');
    expect(textoEmpleador).toContain('Sucursal Este');
    expect(textoEmpleador).not.toContain('Sucursal Norte');
    expect(textoEmpleador).not.toContain('Sucursal Sur');

    const enlacesEmpleado = [
      ...empleado.querySelectorAll<HTMLAnchorElement>('a.sucursal__accion'),
    ];
    const enlacesEmpleador = [
      ...empleador.querySelectorAll<HTMLAnchorElement>('a.sucursal__accion'),
    ];

    expect(enlacesEmpleado.map((enlace) => enlace.getAttribute('href'))).toEqual([
      '/sucursal/111',
      '/sucursal/333',
    ]);
    expect(enlacesEmpleador.map((enlace) => enlace.getAttribute('href'))).toEqual([
      '/sucursal/222',
      '/sucursal/444',
    ]);
    expect(enlacesEmpleado[0].getAttribute('aria-label')).toBe('Ver sucursal Sucursal Norte');
    expect(enlacesEmpleado[0].textContent).toContain('Ver sucursal');

    expect(texto(host())).not.toContain('111');
    expect(texto(host())).not.toContain('222');
    expect(texto(host())).not.toContain('333');
    expect(texto(host())).not.toContain('444');
    expect(title.setTitle).toHaveBeenCalledWith('AppointMee | Mi Perfil');
  });

  it('muestra los estados vacíos de ambas secciones cuando no hay sucursales', () => {
    crear();
    responderPerfil(perfil({ roles: ['EMPLEADO'], sucursalesEmpleado: [] }));

    const [empleado, empleador] = paneles();

    expect(texto(empleado)).toContain('Todavía no sos empleado de ninguna sucursal');
    expect(texto(empleador)).toContain('Todavía no tenés sucursales como empleador');
    expect(texto(empleador)).toContain('Cuando tu cuenta tenga el rol de empleador');
    expect(empleado.querySelectorAll('.sucursal')).toHaveLength(0);
    expect(empleador.querySelectorAll('.sucursal')).toHaveLength(0);
    expect(empleado.querySelector('.panel__count')?.textContent?.trim()).toBe('0');
    expect(empleador.querySelector('.panel__count')?.textContent?.trim()).toBe('0');
    backend.expectNone((request) => request.url.endsWith('/sucursales/listar/propias'));
  });

  it('muestra el vacío de empleado aunque tenga sucursales como empleador', () => {
    sesion.roles = ['EMPLEADO', 'EMPLEADOR'];
    crear();
    responderPerfil(
      perfil({ roles: ['EMPLEADO', 'EMPLEADOR'], sucursalesEmpleado: [] }),
    );
    responderPropias([sucursal(111, 'Sucursal Centro')]);

    const [empleado, empleador] = paneles();

    expect(texto(empleado)).toContain('Todavía no sos empleado de ninguna sucursal');
    expect(texto(empleador)).toContain('Sucursal Centro');
    expect(empleado.querySelectorAll('.sucursal')).toHaveLength(0);
    expect(empleador.querySelectorAll('.sucursal')).toHaveLength(1);
  });

  it('ofrece crear la primera sucursal cuando es empleador y no tiene sucursales', () => {
    sesion.roles = ['EMPLEADOR'];
    crear();
    responderPerfil(perfil({ roles: ['EMPLEADOR'], sucursalesEmpleado: [] }));
    responderPropias([]);

    const [empleado, empleador] = paneles();

    expect(texto(empleado)).toContain('Todavía no sos empleado de ninguna sucursal');
    expect(texto(empleador)).toContain('Todavía no tenés sucursales como empleador');
    expect(texto(empleador)).toContain('Cuando crees tu primera sucursal');

    const crearSucursal = empleador.querySelector<HTMLAnchorElement>(
      'a[href="/mis-sucursales/nueva"]',
    );
    expect(crearSucursal?.textContent).toContain('Crear sucursal');
  });

  it('muestra un error inline del perfil y permite reintentar sin duplicar la carga', () => {
    crear();
    fallarPerfil(500);

    expect(texto(host())).toContain('No pudimos mostrar tu perfil');
    expect(host().querySelector('[role="alert"]')).not.toBeNull();

    const boton = host().querySelector<HTMLButtonElement>('.perfil__estado-acciones button');
    expect(boton).not.toBeNull();
    expect(boton?.getAttribute('aria-busy')).toBeNull();

    boton!.click();
    boton!.click();
    fixture.detectChanges();

    const pendientes = backend.match((request) => request.url.endsWith('/usuarios/42'));
    expect(pendientes).toHaveLength(1);
    expect(boton?.disabled).toBe(true);
    expect(boton?.getAttribute('aria-busy')).toBe('true');
    expect(texto(host())).toContain('Reintentando');

    pendientes[0].flush(perfil());
    fixture.detectChanges();

    expect(texto(host())).toContain('Ana Pérez');
    expect(host().querySelector('.perfil__estado')).toBeNull();
  });

  it('muestra el estado sin conexión del perfil', () => {
    crear();
    fallarPerfil(0);

    expect(texto(host())).toContain('No pudimos conectarnos');
    expect(texto(host())).toContain('Revisá tu conexión a internet');
    expect(host().querySelector('[role="alert"]')).not.toBeNull();
  });

  it('mantiene el perfil visible si fallan las sucursales como empleador y permite reintentar', () => {
    sesion.roles = ['EMPLEADOR'];
    crear();
    responderPerfil(perfil({ roles: ['EMPLEADOR'], sucursalesEmpleado: [] }));

    backend
      .expectOne((request) => request.url.endsWith('/sucursales/listar/propias'))
      .flush({}, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    const [empleado, empleador] = paneles();

    expect(texto(host())).toContain('Ana Pérez');
    expect(texto(empleado)).toContain('Todavía no sos empleado de ninguna sucursal');
    expect(texto(empleador)).toContain('No pudimos cargar tus sucursales');
    expect(texto(empleador)).toContain('Intentá de nuevo en unos segundos');

    const boton = empleador.querySelector<HTMLButtonElement>('.panel__error button');
    expect(boton).not.toBeNull();

    boton!.click();
    boton!.click();
    fixture.detectChanges();

    expect(empleador.querySelector('.panel__error')).not.toBeNull();
    expect(texto(empleador)).toContain('Reintentando');
    expect(boton?.disabled).toBe(true);
    expect(boton?.getAttribute('aria-busy')).toBe('true');

    const reintento = backend.match((request) =>
      request.url.endsWith('/sucursales/listar/propias'),
    );
    expect(reintento).toHaveLength(1);

    reintento[0].flush([sucursal(111, 'Sucursal Centro')]);
    fixture.detectChanges();

    expect(texto(empleador)).toContain('Sucursal Centro');
    expect(texto(empleador)).not.toContain('No pudimos cargar tus sucursales');
    expect(empleador.querySelector('.panel__error')).toBeNull();
  });

  it('usa las iniciales y el placeholder cuando fallan las imágenes', () => {
    crear();
    responderPerfil(
      perfil({
        fotoPerfil: 'https://imagenes.example/perfil-rota.jpg',
        sucursalesEmpleado: [
          sucursal(111, 'Sucursal Norte', {
            fotoPerfil: 'https://imagenes.example/sucursal-rota.jpg',
          }),
        ],
      }),
    );

    const avatar = host().querySelector<HTMLImageElement>('img.perfil__avatar');
    expect(avatar?.getAttribute('alt')).toBe('Foto de perfil de Ana Pérez');

    avatar?.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    expect(host().querySelector('img.perfil__avatar')).toBeNull();
    expect(host().querySelector('.perfil__avatar--iniciales')?.textContent?.trim()).toBe('AP');

    const fotoSucursal = host().querySelector<HTMLImageElement>('.sucursal__foto img');
    fotoSucursal?.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    const reemplazo = host().querySelector<HTMLImageElement>('.sucursal__foto img');
    expect(reemplazo?.getAttribute('src')).toContain('data:image/svg+xml');
    expect(reemplazo?.getAttribute('alt')).toBe('Sin imagen disponible para Sucursal Norte');
  });

  it('muestra la puntuación con abejas, el valor numérico y el estado sin reseñas', () => {
    const conResenias = sucursal(111, 'Sucursal Norte', {
      puntuacion: 4.3,
      cantidadPuntuaciones: 12,
    });
    const sinResenias = sucursal(222, 'Sucursal Sur', {
      puntuacion: null,
      cantidadPuntuaciones: 0,
    });

    crear();
    responderPerfil(perfil({ sucursalesEmpleado: [conResenias, sinResenias] }));

    const tarjetas = host().querySelectorAll<HTMLElement>('.panel--empleado .sucursal');

    expect(tarjetas).toHaveLength(2);
    expect(tarjetas[0].querySelectorAll('.abeja')).toHaveLength(5);
    expect(tarjetas[0].querySelectorAll('.abeja--vacia')).toHaveLength(1);
    expect(texto(tarjetas[0])).toContain('Puntuación 4.3 de 5, 12 reseñas');
    expect(texto(tarjetas[0])).toContain('4.3');
    expect(texto(tarjetas[0])).toContain('12 reseñas');
    expect(texto(tarjetas[1])).toContain('Sin reseñas');
    expect(tarjetas[1].querySelectorAll('.abeja--vacia')).toHaveLength(5);
  });

  it('activa el scroll interno en las secciones con más de cuatro sucursales', () => {
    sesion.roles = ['EMPLEADO', 'EMPLEADOR'];
    const empleado = [1, 2, 3, 4, 5].map((id) => sucursal(id, `Empleado ${id}`));
    const empleador = [11, 12, 13, 14, 15].map((id) => sucursal(id, `Empleador ${id}`));

    crear();
    responderPerfil(
      perfil({ roles: ['EMPLEADO', 'EMPLEADOR'], sucursalesEmpleado: empleado }),
    );
    responderPropias(empleador);

    const [panelEmpleado, panelEmpleador] = paneles();
    const listaEmpleado = panelEmpleado.querySelector<HTMLElement>('.sucursales');
    const listaEmpleador = panelEmpleador.querySelector<HTMLElement>('.sucursales');

    for (const lista of [listaEmpleado, listaEmpleador]) {
      expect(lista?.classList).toContain('sucursales--scroll');
      expect(lista?.getAttribute('tabindex')).toBe('0');
      expect(lista?.getAttribute('aria-label')).toContain('lista desplazable');
      expect(lista?.querySelectorAll('.sucursal')).toHaveLength(5);
    }
  });

  it('no activa el scroll interno cuando hay cuatro sucursales o menos', () => {
    sesion.roles = ['EMPLEADO', 'EMPLEADOR'];
    const empleado = [1, 2, 3, 4].map((id) => sucursal(id, `Empleado ${id}`));
    const empleador = [11, 12, 13, 14].map((id) => sucursal(id, `Empleador ${id}`));

    crear();
    responderPerfil(
      perfil({ roles: ['EMPLEADO', 'EMPLEADOR'], sucursalesEmpleado: empleado }),
    );
    responderPropias(empleador);

    const [panelEmpleado, panelEmpleador] = paneles();
    const listaEmpleado = panelEmpleado.querySelector<HTMLElement>('.sucursales');
    const listaEmpleador = panelEmpleador.querySelector<HTMLElement>('.sucursales');

    for (const lista of [listaEmpleado, listaEmpleador]) {
      expect(lista?.classList).not.toContain('sucursales--scroll');
      expect(lista?.getAttribute('tabindex')).toBeNull();
      expect(lista?.getAttribute('aria-label')).toBeNull();
    }
  });
});
