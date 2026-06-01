import { test, expect, devices, type Page } from '@playwright/test';

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill(email!);
  await page.getByLabel('Contraseña').fill(password!);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(async () =>
      page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth + 1,
      ),
    )
    .toBe(true);
}

test.use({ ...devices['Pixel 5'] });

test.describe('Mobile dashboard redesign', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(
      !email || !password,
      'Set E2E_EMAIL and E2E_PASSWORD to run authenticated mobile dashboard E2E',
    );

    await login(page);
  });

  test('shows mobile-first client form chrome', async ({ page }) => {
    await page.goto('/dashboard/clients/new');

    await expect(page.getByText('Nuevo cliente')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Información del cliente' }),
    ).toBeVisible();
    await expect(page.getByLabel('Nombre')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Crear' })).toBeVisible();
  });

  test('shows mobile-first admin list controls', async ({ page }) => {
    await page.goto('/dashboard/users');

    await expect(page.getByText('Usuarios')).toBeVisible();
    await expect(
      page.getByPlaceholder('Buscar por nombre, correo, empresa, rol o ID...'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /Filtrar correo/ })).toHaveCount(3);
    await expect(page.getByText(/de \d+ usuarios/)).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('shows mobile-first account page chrome', async ({ page }) => {
    await page.goto('/dashboard/account');

    await expect(page.getByText('Mi cuenta')).toBeVisible();
    await expect(page.getByText('Perfil y empresa')).toBeVisible();
    await expect(page.getByText('Empresa')).toBeVisible();
  });
});
