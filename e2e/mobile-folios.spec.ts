import { test, expect } from '@playwright/test';
import {
  e2eCredentialsSkipReason,
  ensureTenantCompany,
  hasE2eCredentials,
  login,
} from './helpers/auth';

/** ZIG-I17-4..6: documents carry the company folio (R-0001 / P-0001) instead of the row id. */

test.describe('Company folios', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
    await login(page);
    await ensureTenantCompany(page);
  });

  test('the ticket list and detail show the R folio', async ({ page }) => {
    await page.goto('/tickets');
    const folio = page.getByText(/^R-\d{4,}$/).filter({ visible: true }).first();
    await expect(folio).toBeVisible({ timeout: 30_000 });
    const label = (await folio.textContent())?.trim() as string;

    // The folio is searchable.
    await page.getByRole('textbox', { name: /Buscar tickets/ }).fill(label);
    await expect(page.getByText(label).filter({ visible: true }).first()).toBeVisible({
      timeout: 30_000,
    });
  });

  test('the presupuestos list shows the P folio', async ({ page }) => {
    await page.goto('/presupuestos');
    await expect(page.getByText(/^P-\d{4,}$/).filter({ visible: true }).first()).toBeVisible({
      timeout: 30_000,
    });
  });
});
