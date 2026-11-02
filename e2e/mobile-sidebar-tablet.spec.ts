import { test, expect } from '@playwright/test';
import {
  e2eCredentialsSkipReason,
  ensureTenantCompany,
  hasE2eCredentials,
  login,
} from './helpers/auth';

/** ZIG-I36 M-17: below `lg` (768 included) the sidebar is closed and opens from the menu button. */
test.describe('Barra lateral bajo lg (ZIG-I36 M-17)', () => {
  test.use({ viewport: { width: 768, height: 1024 } });
  test.setTimeout(120_000);

  test('starts closed; opens from the button; closes with Escape, backdrop and navigation; focus returns', async ({
    page,
  }) => {
    test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
    await login(page);
    await ensureTenantCompany(page);
    await page.goto('/tickets');

    const nav = page.getByRole('dialog', { name: 'Menú de navegación' });
    const openButton = page
      .getByRole('button', { name: 'Abrir menú de navegación', exact: true })
      .filter({ visible: true })
      .first();

    // Closed by default: no dialog, no sidebar column squeezing the list.
    await expect(nav).toBeHidden();
    await expect(openButton).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1),
    ).toBe(true);

    // Escape closes it and gives the focus back to the button.
    await openButton.click();
    await expect(nav).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(nav).toBeHidden();
    await expect(openButton).toBeFocused();

    // Backdrop closes it.
    await openButton.click();
    await expect(nav).toBeVisible();
    await page.mouse.click(740, 600);
    await expect(nav).toBeHidden();
    await expect(openButton).toBeFocused();

    // Navigating closes it.
    await openButton.click();
    await nav.getByRole('link', { name: 'Clientes' }).click();
    await expect(page).toHaveURL(/\/clients/);
    await expect(nav).toBeHidden();
  });

  test('stays a fixed sidebar from lg up', async ({ page }) => {
    test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
    await page.setViewportSize({ width: 1280, height: 800 });
    await login(page);
    await ensureTenantCompany(page);
    await page.goto('/tickets');
    await expect(page.getByRole('link', { name: 'Clientes' }).first()).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Menú de navegación' })).toBeHidden();
  });
});
