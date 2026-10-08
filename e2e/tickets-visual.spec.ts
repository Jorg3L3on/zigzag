import { test, expect } from '@playwright/test';
import {
  e2eCredentialsSkipReason,
  ensureTenantCompany,
  hasE2eCredentials,
  login,
} from './helpers/auth';

/**
 * Visual regression baselines for decomposed ticket list surfaces.
 * Viewport-sized and with ticket data masked, so baselines do not drift as the
 * E2E tenant gains tickets (other specs create them).
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

    await expect(page.locator('tbody tr').first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page).toHaveScreenshot('tickets-list-desktop.png', {
      fullPage: false,
      mask: [page.locator('tbody'), page.getByText(/de \d+ tickets/)],
    });
  });

  test('mobile tickets list matches baseline', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/tickets');
    await expect(page.getByPlaceholder('Buscar tickets...')).toBeVisible({
      timeout: 15_000,
    });

    const cards = page.getByRole('button', { name: /^(Ver|Editar) ticket \d+$/ });
    await expect(cards.first()).toBeVisible({ timeout: 15_000 });
    // Viewport shot keeps the floating dock in the baseline.
    await expect(page).toHaveScreenshot('tickets-list-mobile.png', {
      fullPage: false,
      mask: [cards, page.getByText(/de \d+ tickets/)],
    });
  });
});
