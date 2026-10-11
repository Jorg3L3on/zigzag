import { test, expect } from '@playwright/test';
import { e2eCredentialsSkipReason, ensureTenantCompany, hasE2eCredentials, login } from './helpers/auth';

/** ZIG-I18-12: the guide reads ¿Cómo se usa? and is one tap from Más. */
test.describe('Help and first run (ZIG-I18-12)', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
    await login(page);
    await ensureTenantCompany(page);
  });

  test('¿Cómo se usa? is reachable from Más', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('button', { name: /Más opciones de navegación/ }).click();
    const help = page.getByRole('link', { name: '¿Cómo se usa?' });
    await expect(help).toBeVisible();
    await expect(help).toHaveAttribute('href', /guia-empresa/);
    const box = await help.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  });

  test('a company with tickets does not show Anota tu primer trabajo', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByTestId('dashboard-quick-tiles').filter({ visible: true }).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('dashboard-first-job')).toHaveCount(0);
  });
});
