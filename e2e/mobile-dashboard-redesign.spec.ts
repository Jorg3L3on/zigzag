import { test, expect, type Page } from '@playwright/test';
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

test.describe('Mobile dashboard redesign', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
    await login(page);
    await ensureTenantCompany(page);
  });

  test('shows mobile-first client form chrome', async ({ page }) => {
    await page.goto('/clients/new');

    await expect(page.getByTestId('mobile-app-bar').getByText('Nuevo cliente')).toBeVisible();
    await expect(page.getByText('Información del cliente')).toBeVisible();
    await expect(page.getByLabel('Nombre')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Crear' })).toBeVisible();
  });

  test('shows mobile-first admin list controls', async ({ page }) => {
    await page.goto('/users');

    const forbidden = page.getByText('Acceso denegado');
    if (await forbidden.isVisible().catch(() => false)) {
      test.skip(true, 'Current E2E user cannot access users module');
    }

    await expect(page.getByTestId('page-header').getByText('Usuarios')).toBeVisible();
    await expect(
      page.getByPlaceholder('Buscar por nombre, correo, empresa, rol o ID...'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /Filtrar correo:/i })).toHaveCount(3);
    await expect(page.getByText(/de \d+ usuarios/)).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('shows mobile-first account page chrome', async ({ page }) => {
    await page.goto('/account');

    await expect(page.getByTestId('mobile-app-bar').getByText('Mi cuenta')).toBeVisible();
    await expect(page.getByText('Perfil y empresa')).toBeVisible();
    await expect(page.getByText('Empresa', { exact: true })).toBeVisible();
  });
});
