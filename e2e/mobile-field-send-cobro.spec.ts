import { test, expect } from '@playwright/test';
import {
  e2eCredentialsSkipReason,
  ensureTenantCompany,
  hasE2eCredentials,
  login,
} from './helpers/auth';

test.describe('Field send & cobro (Epic D)', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
    await login(page);
    await ensureTenantCompany(page);
  });

  test('Tu día rows open the Enviar sheet from ···', async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'mobile-chrome',
      'Field send menu is validated on mobile viewport',
    );

    await page.goto('/dashboard');
    const tuDia = page.getByTestId('dashboard-tu-dia').filter({ visible: true }).first();
    await expect(tuDia).toBeVisible({ timeout: 30_000 });

    const more = tuDia.getByRole('button', { name: /^Más acciones para / }).first();
    if ((await more.count()) === 0) {
      test.skip(true, 'No Tu día rows in seed for Enviar menu');
    }

    await more.click();
    await page.getByRole('menuitem', { name: /Enviar por WhatsApp/ }).click();
    await expect(page.getByTestId('field-send-menu-sheet')).toBeVisible();
    // Options depend on finished vs open: Voy en camino | Enviar recibo | Recordar saldo
    await expect(
      page.locator('[data-testid^="field-send-option-"]').first(),
    ).toBeVisible();
  });

  test('Tu día Por cobrar lists balances and links to cobranza', async ({ page }) => {
    await page.goto('/dashboard');
    const tuDia = page.getByTestId('dashboard-tu-dia').filter({ visible: true }).first();
    await expect(tuDia).toBeVisible({ timeout: 30_000 });

    await tuDia.getByRole('tab', { name: /Por cobrar/ }).click();
    await expect(tuDia.getByRole('tab', { name: /Por cobrar/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(tuDia.getByRole('link', { name: /Ver cobranza/ })).toHaveAttribute(
      'href',
      '/cobranza',
    );
    // Rows are capped at 5 whatever the tile count says.
    const rows = tuDia.getByRole('list', { name: /Por cobrar/ }).getByRole('listitem');
    expect(await rows.count()).toBeLessThanOrEqual(5);
  });
});
