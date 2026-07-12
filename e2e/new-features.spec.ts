import { test, expect } from '@playwright/test';
import {
  e2eCredentialsSkipReason,
  hasE2eCredentials,
  login,
} from './helpers/auth';

test.describe('Sellability features smoke', () => {
  test.setTimeout(120_000);

  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
    await page.setViewportSize({ width: 1280, height: 900 });
    await login(page);
  });

  test('tenant company self-administration page renders', async ({ page }) => {
    await page.goto('/company');
    await expect(page.getByText('Mi empresa').first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText('RFC').first()).toBeVisible();
  });

  test('trash page renders', async ({ page }) => {
    await page.goto('/trash');
    await expect(page.getByText('Papelera').first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test('global search opens and queries', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('button', { name: /Buscar/ }).first().click();
    await expect(
      page.getByPlaceholder('Buscar tickets, clientes o servicios…'),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('notification bell is present', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(
      page.getByRole('button', { name: /Notificaciones/ }).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('clients page exposes CSV import/export', async ({ page }) => {
    await page.goto('/clients');
    await expect(
      page.getByRole('button', { name: 'Exportar CSV' }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole('button', { name: 'Importar CSV' }),
    ).toBeVisible();
  });
});
