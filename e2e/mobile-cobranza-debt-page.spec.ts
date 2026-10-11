import { test, expect } from '@playwright/test';
import {
  e2eCredentialsSkipReason,
  ensureTenantCompany,
  hasE2eCredentials,
  login,
} from './helpers/auth';

test.describe('Cobranza as the debt page (ZIG-I18-2)', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
    await login(page);
    await ensureTenantCompany(page);
  });

  test('cards lead with days without payment and offer Cobrar + Recordar por WhatsApp', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chrome', 'Phone cards only');

    await page.goto('/cobranza');
    await expect(page.getByText('Quién te debe y desde cuándo').first()).toBeVisible({
      timeout: 30_000,
    });
    const sort = page.getByRole('combobox', { name: 'Ordenar' });
    await expect(sort).toContainText('Días sin pagar');

    // Default order: the longest without a payment first.
    const days = await page
      .getByText(/\d+ días? sin pagar/)
      .allTextContents();
    const numbers = days.map((text) => Number.parseInt(text, 10));
    expect(numbers).toEqual([...numbers].sort((a, b) => b - a));

    const cobrar = page.getByRole('button', { name: 'Cobrar', exact: true }).first();
    await expect(cobrar).toBeVisible();
    await cobrar.click();
    await expect(page.getByRole('button', { name: /^Pagó todo/ })).toBeVisible();
    await page.keyboard.press('Escape');

    const remind = page
      .getByRole('link', { name: /Recordar por WhatsApp/ })
      .or(page.getByRole('button', { name: /Sin teléfono/ }))
      .first();
    await expect(remind).toBeVisible();

    await sort.click();
    await page.getByRole('option', { name: 'Mayor saldo' }).click();
    await expect(sort).toContainText('Mayor saldo');
  });
});
