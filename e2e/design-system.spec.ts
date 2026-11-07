import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('http://localhost:8080/**', route => route.fulfill({
    status: 200, contentType: 'application/json', body: '[]',
  }));
});

for (const width of [320, 390, 1280]) {
  test(`Home muestra los accesos de cuenta sin desbordar a ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const actions = page.locator('.landing-nav__actions');
    for (const name of ['Iniciar sesión', 'Crear cuenta']) {
      const link = actions.getByRole('link', { name, exact: true });
      await expect(link).toBeVisible();
      await expect(link).toBeInViewport();
    }
    const overflow = await page.evaluate(() => Array.from(document.querySelectorAll('body *'))
      .filter(element => element.getBoundingClientRect().right > innerWidth + 1)
      .slice(0, 12).map(element => `${element.tagName}.${element.className}: ${element.getBoundingClientRect().right}`));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), JSON.stringify(overflow)).toBe(true);
    await page.screenshot({ path: `test-results/home-${width}.png`, fullPage: false });
  });
}

for (const path of ['/login', '/registrarme']) {
  test(`${path} conserva el diseño y el estado accesible de Mostrar/Ocultar`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(path);
    const toggle = page.locator('button.login__toggle');
    await expect(toggle).toBeVisible();
    expect(await toggle.evaluate(element => getComputedStyle(element).position)).toBe('absolute');
    const password = page.locator(path === '/login' ? '#login-password' : '#registro-password');
    const inputBox = await password.boundingBox();
    const toggleBox = await toggle.boundingBox();
    expect(toggleBox!.x).toBeGreaterThan(inputBox!.x);
    expect(toggleBox!.x + toggleBox!.width).toBeLessThanOrEqual(inputBox!.x + inputBox!.width);
    await toggle.click();
    await expect(password).toHaveAttribute('type', 'text');
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(toggle).toHaveAccessibleName(path === '/login' ? 'Ocultar contraseña' : 'Ocultar contraseñas');
    const submit = page.locator('button.login__submit');
    expect(await submit.evaluate(element => getComputedStyle(element).borderRadius)).toBe('999px');
    expect(await submit.evaluate(element => getComputedStyle(element).backgroundColor)).toBe('rgb(255, 215, 122)');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/${path.slice(1)}-mobile.png`, fullPage: true });
  });
}

test('modal atrapa el foco inicial, aísla el fondo y devuelve el foco al cerrar', async ({ page }) => {
  await page.goto('/design-system');
  const opener = page.getByRole('button', { name: 'Abrir modal', exact: true });
  await opener.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: 'Cerrar' })).toBeFocused();
  expect(await page.locator('app-navbar').evaluate(element => element.hasAttribute('inert'))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
  await expect(page.locator('app-navbar')).not.toHaveAttribute('inert');
});

test('las combinaciones de texto de los tokens cumplen AA en sus superficies', async ({ page }) => {
  await page.goto('/design-system');
  const ratios = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    const rgb = (token: string) => {
      const hex = style.getPropertyValue(token).trim().replace('#', '');
      return [0, 2, 4].map(offset => parseInt(hex.slice(offset, offset + 2), 16) / 255);
    };
    const luminance = (color: number[]) => color
      .map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4)
      .reduce((total, channel, i) => total + channel * [.2126, .7152, .0722][i], 0);
    const ratio = (foreground: number[], background: number[]) => {
      const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
      return (values[0] + .05) / (values[1] + .05);
    };
    const results: Record<string, number> = {};
    for (const background of ['--page-bg', '--surface']) {
      for (const foreground of ['--text', '--muted', '--accent', '--accent-strong', '--danger', '--success', '--info']) {
        results[`${foreground}/${background}`] = ratio(rgb(foreground), rgb(background));
      }
    }
    for (const [foreground, background] of [['--on-accent', '--accent'], ['--on-danger', '--danger']]) {
      results[`${foreground}/${background}`] = ratio(rgb(foreground), rgb(background));
    }
    return results;
  });
  for (const [combination, ratio] of Object.entries(ratios)) {
    expect(ratio, combination).toBeGreaterThanOrEqual(4.5);
  }
});
