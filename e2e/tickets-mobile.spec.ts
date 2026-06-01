import { test, expect, devices } from '@playwright/test';

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill(email!);
  await page.getByLabel('Contraseña').fill(password!);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
}

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page) {
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

test.describe('Mobile ticket screens', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(
      !email || !password,
      'Set E2E_EMAIL and E2E_PASSWORD to run authenticated ticket E2E',
    );

    await login(page);
  });

  test('shows mobile-first tickets list controls', async ({ page }) => {
    await page.goto('/dashboard/tickets');

    await expect(page.getByRole('heading', { name: 'Tickets' })).toBeVisible();
    await expect(page.getByPlaceholder('Buscar tickets...')).toBeVisible();
    await expect(page.getByRole('button', { name: /Abrir filtros/ })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Nuevo Ticket' })).toBeVisible();
    await expect(page.getByText(/de \d+ tickets/)).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('shows mobile-first create ticket flow', async ({ page }) => {
    await page.goto('/dashboard/tickets/create');

    await expect(page.getByText('Nuevo ticket')).toBeVisible();
    await expect(page.getByText('Paso 1 de 3')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Información del cliente' })).toBeVisible();
    await expect(page.getByLabel('Seleccionar Cliente')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nuevo Cliente' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Crear' })).toBeVisible();
  });
});
