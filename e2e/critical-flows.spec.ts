import { expect, test, type Page, type Route } from '@playwright/test';

const api = 'http://localhost:8080';
const usuario = { id: 4, roles: ['CLIENTE'], fotoPerfil: null };
const tokenResponse = {
  token: 'access-e2e-only',
  accessToken: 'access-e2e-only',
  refreshToken: 'refresh-e2e-only',
  expiresIn: 3600,
  usuario,
};
const sucursal = {
  id: 1,
  nombre: 'Sucursal Demo',
  categoria: 'PELUQUERIA',
  direccion: 'Av. Siempre Viva 123',
  telefono: '1122334455',
  descripcion: 'Sucursal de demostración',
  fechaCreacion: '2025-01-01',
  horaApertura: '09:00',
  horaCierre: '18:00',
  diasApertura: ['MONDAY'],
  puntuacion: 4.5,
  cantidadPuntuaciones: 2,
  fotoPerfil: null,
};
const servicio = {
  id: 3,
  nombre: 'Corte de cabello',
  descripcion: 'Corte clásico',
  duracion: 30,
  precio: 12000,
  fotoPerfil: null,
  puntuacion: 4.5,
  cantidadPuntuaciones: 2,
  nombreSucursal: sucursal.nombre,
  direccionSucursal: sucursal.direccion,
  categoriaSucursal: sucursal.categoria,
};

function watchConsole(page: Page, expectedNetworkErrors: readonly RegExp[] = []): string[] {
  const errors: string[] = [];
  page.on('console', message => {
    if (message.type() === 'error' && !expectedNetworkErrors.some(pattern => pattern.test(message.text()))) {
      errors.push(message.text());
    }
  });
  page.on('pageerror', error => errors.push(error.message));
  return errors;
}

async function reply(route: Route, status: number, body: unknown): Promise<void> {
  await route.fulfill({
    status,
    contentType: 'application/json',
    headers: {
      'access-control-allow-origin': 'http://127.0.0.1:4200',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': 'authorization, content-type, x-verification-token',
    },
    body: JSON.stringify(body),
  });
}

async function mockApi(page: Page, loginIsUnverified = false): Promise<string[]> {
  const unexpected: string[] = [];
  await page.route(`${api}/**`, async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    if (method === 'OPTIONS') {
      return route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': 'http://127.0.0.1:4200',
          'access-control-allow-methods': 'GET, POST, OPTIONS',
          'access-control-allow-headers': 'authorization, content-type, x-verification-token',
        },
      });
    }

    if (method === 'POST' && path === '/auth/login' && loginIsUnverified) {
      return reply(route, 403, {
        code: 'EMAIL_NOT_VERIFIED',
        verificationToken: 'verification-ticket-e2e',
        verificationExpiresIn: 900,
      });
    }
    if (method === 'POST' && path === '/auth/login') return reply(route, 200, tokenResponse);
    if (method === 'POST' && path === '/auth/register') return reply(route, 201, { message: 'Cuenta creada' });
    if (method === 'POST' && path === '/auth/verification-status') {
      return reply(route, 200, {
        verificada: false, enviado: true, enviadoAhora: false,
        retryAfterSeconds: 0, attemptsRemaining: 5, expiresInSeconds: 900,
      });
    }
    if (method === 'POST' && path === '/auth/send-verification') {
      return reply(route, 200, {
        verificada: false, enviado: true, enviadoAhora: true,
        retryAfterSeconds: 0, attemptsRemaining: 5, expiresInSeconds: 900,
      });
    }
    if (method === 'POST' && path === '/auth/verify-email') {
      return reply(route, 200, { ...tokenResponse, message: 'Cuenta verificada' });
    }
    if (method === 'POST' && path === '/auth/forgot-password') {
      return reply(route, 200, { message: 'Si el correo existe, enviaremos el enlace.' });
    }
    if (method === 'POST' && path === '/auth/reset-password/validate') {
      return reply(route, 200, { valido: true, expiresInSeconds: 900 });
    }
    if (method === 'POST' && path === '/auth/reset-password') {
      return reply(route, 200, { message: 'Contraseña restablecida correctamente.' });
    }
    if (method === 'GET' && path === '/usuarios/me') return reply(route, 200, usuario);
    if (method === 'GET' && path === '/sucursales/categorias') return reply(route, 200, ['PELUQUERIA']);
    if (method === 'GET' && path === '/sucursales/listar') return reply(route, 200, [sucursal]);
    if (method === 'GET' && path === '/sucursales/listar/filtrar') {
      return reply(route, 200, url.searchParams.has('nombre') ? [sucursal] : []);
    }
    if (method === 'GET' && path === '/sucursales/1') return reply(route, 200, sucursal);
    if (method === 'GET' && path === '/sucursales/1/resenias') return reply(route, 200, []);
    if (method === 'GET' && path === '/sucursales/1/elegir-empleado') {
      return reply(route, 200, [{ id: 7, nombre: 'Ana', apellido: 'Pérez', urlFotoPerfil: null, puntuacion: null, cantidadPuntuaciones: 0 }]);
    }
    if (method === 'GET' && path === '/servicios/listar/sucursal/1') return reply(route, 200, [servicio]);
    if (method === 'GET' && path === '/turnos/disponibilidad/empleado/7/servicio/3') {
      return reply(route, 200, [{ fecha: '2030-12-20', horarios: ['09:00:00', '10:00:00'] }]);
    }

    unexpected.push(`${method} ${path}`);
    return reply(route, 404, { message: 'No mock for this request' });
  });
  return unexpected;
}

test('login dirige a una ruta interna y no registra errores de consola', async ({ page }) => {
  const consoleErrors = watchConsole(page);
  const unexpected = await mockApi(page);
  await page.goto('/login?returnTo=%2Fsucursales');
  await page.getByLabel('Email', { exact: true }).fill('ana@example.com');
  await page.getByLabel('Contraseña', { exact: true }).fill('Clave123!');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();

  await expect(page).toHaveURL(/\/sucursales$/);
  await expect(page.getByRole('heading', { name: 'Encontrá tu sucursal' })).toBeVisible();
  expect(unexpected).toEqual([]);
  expect(consoleErrors).toEqual([]);
});

test('registro y verificación por código no exponen errores de consola', async ({ page }) => {
  // El endpoint actual devuelve 403 como señal de cuenta pendiente; el navegador
  // informa ese status aunque la UI lo gestione y no sea una excepción del frontend.
  const consoleErrors = watchConsole(page, [/status of 403 \(Forbidden\)/]);
  const unexpected = await mockApi(page, true);
  await page.goto('/registrarme');
  await page.locator('#registro-nombre').fill('Ana');
  await page.locator('#registro-apellido').fill('Pérez');
  await page.locator('#registro-email').fill('ana@example.com');
  await page.locator('#registro-confirmarEmail').fill('ana@example.com');
  await page.locator('#registro-password').fill('Clave123!');
  await page.locator('#registro-confirmarPassword').fill('Clave123!');
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(page.getByText('Tu cuenta fue creada. Iniciá sesión para continuar con la verificación de tu email.')).toBeVisible();

  await page.getByLabel('Email', { exact: true }).fill('ana@example.com');
  await page.getByLabel('Contraseña', { exact: true }).fill('Clave123!');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await page.getByRole('button', { name: 'Aceptar y verificar' }).click();
  await expect(page.getByText('Te enviamos un código de 6 dígitos')).toBeVisible();

  await page.getByLabel('Dígito 1 de 6').fill('123456');
  await page.getByRole('button', { name: 'Verificar', exact: true }).click();
  await expect(page).toHaveURL(/\/sucursales$/);
  expect(unexpected).toEqual([]);
  expect(consoleErrors).toEqual([]);
});

test('recuperación valida el enlace y mantiene el token fuera de URL e historial', async ({ page }) => {
  const consoleErrors = watchConsole(page);
  const unexpected = await mockApi(page);
  const resetToken = 'fragment_token_1234567890123';
  await page.goto(`/reset-password#token=${resetToken}`);

  await expect(page).toHaveURL('http://127.0.0.1:4200/reset-password');
  await expect(page.getByLabel('Nueva contraseña', { exact: true })).toBeVisible();
  await page.getByLabel('Nueva contraseña', { exact: true }).fill('NuevaClave123!');
  await page.getByLabel('Confirmar nueva contraseña').fill('NuevaClave123!');
  await page.getByRole('button', { name: 'Guardar nueva contraseña' }).click();
  await expect(page.getByRole('heading', { name: 'Contraseña restablecida' })).toBeVisible();

  expect(unexpected).toEqual([]);
  expect(consoleErrors).toEqual([]);
});

test('recuperación de contraseña responde con mensaje genérico', async ({ page }) => {
  const consoleErrors = watchConsole(page);
  const unexpected = await mockApi(page);
  await page.goto('/olvide-mi-contrasena');
  await page.getByLabel('Email').fill('ana@example.com');
  await page.getByRole('button', { name: 'Enviar enlace de recuperación' }).click();

  await expect(page.getByText('Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.')).toBeVisible();
  expect(unexpected).toEqual([]);
  expect(consoleErrors).toEqual([]);
});

test('búsqueda conserva el término y muestra resultados sin errores de consola', async ({ page }) => {
  const consoleErrors = watchConsole(page);
  const unexpected = await mockApi(page);
  await page.goto('/sucursales');
  await page.getByRole('searchbox', { name: 'Buscar sucursales por nombre' }).fill('Sucursal');

  await expect(page.getByRole('heading', { name: 'Sucursal Demo' })).toBeVisible();
  await expect(page).toHaveURL(/busqueda=Sucursal/);
  expect(unexpected).toEqual([]);
  expect(consoleErrors).toEqual([]);
});

test('detalle permite elegir un servicio y consultar horarios sin errores de consola', async ({ page }) => {
  const consoleErrors = watchConsole(page);
  const unexpected = await mockApi(page);
  await page.goto('/sucursal/1');
  await expect(page.getByRole('heading', { name: 'Sucursal Demo' })).toBeVisible();
  await page.getByRole('button', { name: 'Reservar turno en Sucursal Demo' }).click();
  await expect(page).toHaveURL(/\/sucursal\/1\/servicios$/);
  await expect(page.getByRole('heading', { name: 'Corte de cabello' })).toBeVisible();
  await page.getByRole('link', { name: 'Elegir horario para Corte de cabello' }).click();

  await expect(page).toHaveURL(/\/sucursal\/1\/servicios\/3\/turnos$/);
  await expect(page.getByRole('button', { name: 'Elegir 09:00 del 2030-12-20' })).toBeVisible();
  expect(unexpected).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
