import { readFile } from 'node:fs/promises';
import { expect, test as baseTest, type Page, type Route } from '@playwright/test';

const sensitiveValues = [
  'Clave123!', 'NuevaClave123!', '123456',
  'access-e2e-only', 'refresh-e2e-only', 'verification-ticket-e2e',
  'fragment_token_1234567890123',
];

function containsSensitiveValue(value: string): boolean {
  let decoded = value;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (sensitiveValues.some(secret => decoded.includes(secret))) return true;
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch { break; }
  }
  return false;
}

function watchSensitiveData(page: Page) {
  const leaks: string[] = [];
  const pending: Promise<void>[] = [];
  const check = (surface: string, value: string) => {
    // El reporte indica el destino, nunca vuelve a imprimir la credencial.
    if (containsSensitiveValue(value)) leaks.push(surface);
  };
  page.on('console', message => {
    check('consola', message.text());
    pending.push(Promise.all(message.args().map(async arg => {
      try { check('argumento de consola', JSON.stringify(await arg.jsonValue()) ?? ''); }
      catch { /* Un objeto de una página cerrada ya no puede inspeccionarse. */ }
    })).then(() => undefined));
  });
  page.on('pageerror', error => check('excepción del navegador', error.message));
  page.on('request', request => {
    check('URL de solicitud', request.url());
    // Los cuerpos y headers de autenticación pueden contener credenciales.
    // En analytics y otros destinos externos no deben aparecer.
    const url = new URL(request.url());
    const analytics = /\/(?:_vercel\/insights|analytics)(?:\/|$)/.test(url.pathname)
      || url.hostname === 'vitals.vercel-insights.com';
    if (analytics || (url.origin !== api && url.origin !== 'http://127.0.0.1:4200')) {
      check('cuerpo de analytics o tercero', request.postData() ?? '');
      check('headers de analytics o tercero', JSON.stringify(request.headers()));
    }
  });
  return async () => {
    await Promise.all(pending);
    check('URL final', page.url());
    expect(leaks, 'Se detectaron datos sensibles fuera de los endpoints de autenticación').toEqual([]);
  };
}

const test = baseTest.extend({
  page: async ({ page }, use) => {
    const assertNoLeaks = watchSensitiveData(page);
    await use(page);
    await assertNoLeaks();
  },
});

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
    if (method === 'POST' && path === '/auth/change-password') {
      return reply(route, 200, { message: 'Contraseña modificada.' });
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
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText('Tu contraseña se actualizó. Ya podés iniciar sesión', { exact: true })).toBeVisible();

  expect(unexpected).toEqual([]);
  expect(consoleErrors).toEqual([]);
});

for (const status of [400, 401]) {
test(`Ajustes conserva la sesión ante contraseña actual incorrecta ${status} y sale al guardar`, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const unexpected = await mockApi(page);
  let intento = 0;
  await page.route(`${api}/auth/change-password`, route => {
    if (route.request().method() === 'OPTIONS') return reply(route, 204, null);
    intento++;
    return intento === 1
      ? reply(route, status, status === 401 ? 'Contraseña actual incorrecta' : { code: 'CURRENT_PASSWORD_INVALID', message: 'La contraseña actual es incorrecta.' })
      : reply(route, 200, { message: 'Actualizada' });
  });
  await page.goto('/login?returnTo=%2Fconfiguracion');
  await page.getByLabel('Email', { exact: true }).fill('ana@example.com');
  await page.getByLabel('Contraseña', { exact: true }).fill('Clave123!');
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  await expect(page).toHaveURL(/\/configuracion$/);
  await page.getByRole('button', { name: 'Cambiar contraseña', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/cambiar-password-mobile.png', fullPage: true });
  for (let index = 0; index < 2; index++) {
    await page.getByLabel('Contraseña actual', { exact: true }).fill('Clave123!');
    await page.getByLabel('Nueva contraseña', { exact: true }).fill('NuevaClave123!');
    await page.getByLabel('Confirmar nueva contraseña', { exact: true }).fill('NuevaClave123!');
    await page.getByRole('button', { name: 'Guardar nueva contraseña', exact: true }).click();
    if (index === 0) {
      await expect(page.getByText('La contraseña actual es incorrecta.', { exact: true })).toBeVisible();
      await expect(page).toHaveURL(/\/configuracion$/);
      await expect(page.getByLabel('Contraseña actual', { exact: true })).toHaveValue('');
    }
  }
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText('Tu contraseña se actualizó. Iniciá sesión nuevamente por seguridad', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('refreshToken'))).toBeNull();
  expect(unexpected).toEqual([]);
});
}

test('un enlace inválido o utilizado muestra el error sin ofrecer otro enlace', async ({ page }) => {
  await mockApi(page);
  await page.route(`${api}/auth/reset-password/validate`, route => {
    if (route.request().method() === 'OPTIONS') return reply(route, 204, null);
    return reply(route, 200, { valido: false, expiresInSeconds: 0 });
  });
  await page.goto('/reset-password#token=fragment_token_1234567890123');
  await expect(page.getByRole('alert')).toContainText('ya fue utilizado');
  await expect(page.locator('input')).toHaveCount(0);
  await expect(page.getByRole('link', { name: /nuevo enlace/i })).toHaveCount(0);
  await expect(page.locator('a[href="/olvide-mi-contrasena"]')).toHaveCount(0);
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

test('detalle permite seleccionar un servicio sin errores de consola', async ({ page }) => {
  const consoleErrors = watchConsole(page);
  const unexpected = await mockApi(page);
  await page.goto('/sucursal/1');
  await expect(page.getByRole('heading', { name: 'Sucursal Demo' })).toBeVisible();
  await page.getByRole('button', { name: 'Reservar turno en Sucursal Demo' }).click();
  await expect(page).toHaveURL(/\/sucursal\/1\/servicios$/);
  await expect(page.getByRole('heading', { name: 'Seleccionar servicio' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Corte de cabello' })).toBeVisible();

  const empleado = page.getByRole('button', { name: 'Seleccionar empleado' });
  await expect(empleado).toBeDisabled();
  await page.getByRole('button', { name: 'Seleccionar Corte de cabello' }).click();
  await expect(empleado).toBeEnabled();
  await expect(page).toHaveURL(/\/sucursal\/1\/servicios$/);
  expect(unexpected).toEqual([]);
  expect(consoleErrors).toEqual([]);
});

test('analytics elimina parámetros y fragmentos sensibles antes de enviarlos', async ({ page }) => {
  const bootstrap = await readFile('public/analytics-bootstrap.js', 'utf8');
  // Activa el bootstrap de producción solo en este test local.
  await page.route('**/analytics-bootstrap.js', route => route.fulfill({
    contentType: 'application/javascript',
    body: bootstrap.replace("if (['localhost', '127.0.0.1'].includes(window.location.hostname)) return;", ''),
  }));
  await page.route('**/_vercel/insights/script.js', route => route.fulfill({
    contentType: 'application/javascript',
    // Simula el consumidor de beforeSend; se prueba el filtro real del proyecto.
    body: `
      const hook = window.vaq.find(entry => entry[0] === 'beforeSend')[1];
      const event = hook({url: location.origin + '/login?password=Clave123!&otp=123456&token=access-e2e-only#refresh-e2e-only'});
      fetch('/_vercel/insights/view', {method: 'POST', body: JSON.stringify(event)});
    `,
  }));
  await page.route('**/_vercel/insights/view', route => route.fulfill({ status: 204 }));
  await mockApi(page);
  const sent = page.waitForRequest('**/_vercel/insights/view');
  await page.goto('/login');
  expect((await sent).postDataJSON()).toEqual({ url: 'http://127.0.0.1:4200/login' });
});

baseTest('el detector reconoce filtraciones en objetos de consola y analytics', async ({ page }) => {
  await mockApi(page);
  await page.route('**/_vercel/insights/view', route => route.fulfill({ status: 204 }));
  await page.goto('/login');
  const assertNoLeaks = watchSensitiveData(page);
  await page.evaluate(async () => {
    console.log({ password: 'Clave123!' });
    await fetch('/_vercel/insights/view', {
      method: 'POST', body: JSON.stringify({ otp: '123456', token: 'access-e2e-only' }),
    });
  });
  await expect(assertNoLeaks()).rejects.toThrow(/argumento de consola/);
  await expect(assertNoLeaks()).rejects.toThrow(/cuerpo de analytics o tercero/);
  expect(containsSensitiveValue('Clave123%2521')).toBe(true);
  expect(containsSensitiveValue('registro completado')).toBe(false);
});
