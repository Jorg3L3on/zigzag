import { test, expect } from '@playwright/test';
import {
  e2eCredentialsSkipReason,
  ensureTenantCompany,
  hasE2eCredentials,
  login,
} from './helpers/auth';

/**
 * Epic A #429 — mobile campo home must not flash office charts.
 */
test.describe('Mobile campo Hoy home (Epic A)', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
    await login(page);
    await ensureTenantCompany(page);
  });

  test('hides revenue charts and shows Hoy-first campo layout', async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'mobile-chrome',
      'Campo mobile composition is validated on Pixel viewport',
    );

    await page.goto('/company');
    await expect(page.getByLabel('Experiencia de inicio')).toBeVisible({
      timeout: 30_000,
    });
    await page.getByLabel('Experiencia de inicio').click();
    await page.getByRole('option', { name: 'Campo', exact: true }).click();
    await page.getByRole('button', { name: /Guardar cambios|Guardar/i }).click();
    await expect(page.getByText(/Empresa actualizada|guardado/i).first()).toBeVisible({
      timeout: 30_000,
    }).catch(() => undefined);

    await page.goto('/dashboard');
    await expect(page.getByText(/Tu día en el campo|Trabajo de hoy/i).first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.locator('#dashboard-revenue-chart-title')).toHaveCount(0);
    await expect(page.getByTestId('mobile-bottom-tab-bar')).toBeVisible();
  });
});
