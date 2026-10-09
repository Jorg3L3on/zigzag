import { test, expect } from '@playwright/test';
import {
  e2eCredentialsSkipReason,
  ensureTenantCompany,
  hasE2eCredentials,
  login,
} from './helpers/auth';

/**
 * ZIG-I5-6 visual baselines for presupuestos at 375px, light and dark.
 * Data-bearing regions are masked so baselines do not drift as the tenant
 * gains quotes. Read-only: the composer shot cancels before saving.
 *
 * Update snapshots:
 *   npm run test:e2e:visual:update -- e2e/presupuestos-visual.spec.ts
 */
for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`Presupuestos visual (${colorScheme})`, () => {
    test.use({ viewport: { width: 375, height: 812 }, colorScheme });
    test.setTimeout(180_000);

    test.beforeEach(async ({ page }) => {
      test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
      await login(page);
      await ensureTenantCompany(page);
    });

    test('list', async ({ page }) => {
      await page.goto('/presupuestos');
      await expect(
        page.getByRole('group', { name: 'Filtrar por estado' }),
      ).toBeVisible({ timeout: 15_000 });
      await expect(page).toHaveScreenshot(`presupuestos-list-${colorScheme}.png`, {
        fullPage: false,
        mask: [
          page.getByTestId('presupuesto-row'),
          page.getByRole('group', { name: 'Filtrar por estado' }),
        ],
      });
    });

    test('composer with the Nuevo line sheet', async ({ page }) => {
      await page.goto('/presupuestos/create');
      await expect(
        page.getByRole('heading', { name: 'Cliente', exact: true }),
      ).toBeVisible({ timeout: 15_000 });
      await page.getByRole('button', { name: 'Agregar servicio' }).click();
      const sheet = page.getByRole('dialog', { name: 'Agregar servicio' });
      await sheet.getByRole('radio', { name: /Nuevo/ }).click();
      await sheet.getByLabel('Nombre del servicio').fill('Cambio de capacitor 35 µF');
      await sheet.getByRole('spinbutton', { name: 'Precio del servicio' }).fill('850');
      await page.waitForTimeout(600);
      await expect(page).toHaveScreenshot(`presupuestos-line-sheet-${colorScheme}.png`, {
        fullPage: false,
        mask: [page.getByRole('button', { name: /^Hoy ·|de \w+/ })],
      });
      await sheet.getByRole('button', { name: 'Cancelar' }).click();
    });

    test('detail', async ({ page }) => {
      await page.goto('/presupuestos');
      const firstRow = page.getByTestId('presupuesto-row').first();
      await expect(
        page.getByRole('group', { name: 'Filtrar por estado' }),
      ).toBeVisible({ timeout: 15_000 });
      test.skip((await firstRow.count()) === 0, 'No presupuestos for this tenant yet');
      const href = await firstRow.getByRole('link').first().getAttribute('href');
      await page.goto(href!);
      await expect(page.getByTestId('presupuesto-status').first()).toBeVisible({
        timeout: 15_000,
      });
      await page.waitForTimeout(800);
      await expect(page).toHaveScreenshot(`presupuestos-detail-${colorScheme}.png`, {
        fullPage: false,
        mask: [
          page.getByTestId('presupuesto-header'),
          page.locator('section').filter({ hasText: 'Cliente' }),
          page.getByRole('list', { name: 'Servicios del presupuesto' }),
          page.getByTestId('review-total'),
          page.getByTestId('presupuesto-summary'),
          page.getByTestId('presupuesto-pdf-preview'),
          page.getByText(/^\$[\d,]+\.\d{2}$/),
          page.getByText(/^Presupuesto #\d+$/),
        ],
      });
    });
  });
}
