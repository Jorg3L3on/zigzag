import { test, expect, devices, type Page } from '@playwright/test';
import {
  e2eCredentialsSkipReason,
  ensureTenantCompany,
  hasE2eCredentials,
  login,
} from './helpers/auth';

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

test.describe('Mobile ticket screens', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
    await login(page);
    await ensureTenantCompany(page);
  });

  test('shows mobile-first tickets list controls', async ({ page }) => {
    await page.goto('/dashboard/tickets');

    await expect(page.getByTestId('page-header').getByText('Tickets')).toBeVisible();
    await expect(page.getByPlaceholder('Buscar tickets...')).toBeVisible();
    await expect(page.getByRole('button', { name: /Abrir filtros/ })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Nuevo ticket' })).toBeVisible();
    await expect(page.getByText(/de \d+ tickets/)).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('shows mobile-first create ticket flow', async ({ page }) => {
    await page.goto('/dashboard/tickets/create');

    await expect(page.getByTestId('mobile-app-bar').getByText('Nuevo ticket')).toBeVisible();
    await expect(page.getByText('Paso 1 de 3')).toBeVisible();
    await expect(page.getByText('Información del cliente')).toBeVisible();
    await expect(page.getByText('Seleccionar cliente')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nuevo cliente' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Crear', exact: true })).toBeVisible();
  });
});
