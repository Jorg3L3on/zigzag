import { test, expect } from '@playwright/test';
import {
  e2eCredentialsSkipReason,
  e2eSystemCredentialsSkipReason,
  hasE2eCredentials,
  hasE2eSystemCredentials,
  login,
  loginAsSystemUser,
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
    test.skip(!hasE2eSystemCredentials, e2eSystemCredentialsSkipReason);
    await loginAsSystemUser(page);
    await page.goto('/trash');
    await expect(page.getByText('Papelera').first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test('notification bell is present', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(
      page.getByRole('button', { name: /Notificaciones/ }).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('clients page exposes CSV import without export', async ({ page }) => {
    await page.goto('/clients');
    await expect(
      page.getByRole('button', { name: 'Importar CSV' }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole('button', { name: 'Exportar CSV' }),
    ).toHaveCount(0);
  });

  test('tickets and services pages have no CSV export', async ({ page }) => {
    await page.goto('/tickets');
    await expect(page.getByText('Tickets').first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByRole('button', { name: 'Exportar CSV' }),
    ).toHaveCount(0);

    await page.goto('/services');
    await expect(page.getByRole('link', { name: 'Importar CSV' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByRole('button', { name: 'Exportar CSV' }),
    ).toHaveCount(0);
  });

  test('services CSV import previews and commits', async ({ page }) => {
    const name = `E2E import ${Date.now()}`;
    await page.goto('/services/import');
    await page
      .getByLabel('Archivo CSV para importar servicios')
      .setInputFiles({
        name: 'servicios.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(`nombre,descripción,precio\n${name},Prueba e2e,150\n`),
      });
    await expect(page.getByRole('heading', { name: 'Vista previa' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(name)).toBeVisible();

    await page.getByRole('button', { name: 'Confirmar importación (1)' }).click();
    await expect(page.getByText('1 servicios importados')).toBeVisible({
      timeout: 15_000,
    });
  });
});
