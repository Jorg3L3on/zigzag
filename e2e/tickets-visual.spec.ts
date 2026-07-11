import { test, expect } from '@playwright/test';
import {
  e2eCredentialsSkipReason,
  ensureTenantCompany,
  hasE2eCredentials,
  login,
} from './helpers/auth';

/**
 * Visual regression baselines for decomposed ticket list surfaces.
 * Requires E2E_COMPANY_NAME to match the tenant company for E2E_EMAIL.
 *
 * Update snapshots:
 *   npm run test:e2e:visual:update
 */
test.describe('Tickets visual baselines', () => {
  test.setTimeout(180_000);

  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
    await login(page);
    await ensureTenantCompany(page);
  });

  test('desktop tickets list matches baseline', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/tickets');
    await expect(page.getByPlaceholder('Buscar tickets...')).toBeVisible({
      timeout: 15_000,
    });

    const main = page.locator('main');
    await expect(main).toHaveScreenshot('tickets-list-desktop.png');
  });

  test('mobile tickets list matches baseline', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/tickets');
    await expect(page.getByPlaceholder('Buscar tickets...')).toBeVisible({
      timeout: 15_000,
    });

    const main = page.locator('main');
    await expect(main).toHaveScreenshot('tickets-list-mobile.png');
  });
});
