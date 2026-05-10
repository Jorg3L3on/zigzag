import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test('redirects unauthenticated visitors to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('shows dashboard headings after login', async ({ page }) => {
    const email = process.env.E2E_EMAIL;
    const password = process.env.E2E_PASSWORD;
    test.skip(
      !email || !password,
      'Set E2E_EMAIL and E2E_PASSWORD to run authenticated dashboard E2E',
    );

    await page.goto('/login');
    await page.getByLabel('Correo electrónico').fill(email!);
    await page.getByLabel('Contraseña').fill(password!);
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 30_000 });

    await expect(page.getByText('Total de Tickets')).toBeVisible();
    await expect(page.getByText('Ingresos por mes')).toBeVisible();
    await expect(page.getByText('Clientes con mayor gasto')).toBeVisible();
  });
});
