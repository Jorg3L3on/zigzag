import { test, expect } from '@playwright/test';
import {
  e2eCredentialsSkipReason,
  ensureTenantCompany,
  hasE2eCredentials,
  login,
} from './helpers/auth';
import { visiblePageHeader } from './helpers/mobile-chrome';

test.describe('Mobile sidebar sheet', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
    await login(page);
    await ensureTenantCompany(page);
  });

  test('opens navigation sheet and closes without losing page content', async ({
    page,
  }) => {
    await page.goto('/dashboard');

    await expect(visiblePageHeader(page).getByText('Dashboard')).toBeVisible();

    await page.getByRole('button', { name: 'Abrir menú de navegación' }).click();

    const navDialog = page.getByRole('dialog', { name: 'Menú de navegación' });
    await expect(navDialog).toBeVisible();
    await expect(navDialog.getByRole('link', { name: 'Inicio' })).toBeVisible();
    await expect(navDialog.getByRole('link', { name: 'Tickets' })).toBeVisible();

    await page
      .locator('div.fixed.inset-0.z-50.bg-black\\/80')
      .first()
      .click({ position: { x: 320, y: 400 }, force: true });
    await expect(navDialog).toBeHidden();

    await expect(visiblePageHeader(page).getByText('Dashboard')).toBeVisible();
  });

  test('shows mobile ticket cards instead of desktop-only table layout', async ({
    page,
  }) => {
    await page.goto('/tickets');

    await expect(visiblePageHeader(page).getByText('Tickets')).toBeVisible();
    await expect(
      page
        .getByText(/\d+ de \d+ tickets/)
        .or(page.getByText('Sin tickets'))
        .or(page.getByText('Sin resultados'))
        .first(),
    ).toBeVisible();

    const ticketCards = page.getByRole('button', { name: /Ver ticket \d+/ });
    const desktopTable = page.locator('.hidden.md\\:block table');

    if ((await ticketCards.count()) > 0) {
      await expect(ticketCards.first()).toBeVisible();
      await expect(desktopTable).toBeHidden();
      return;
    }

    await expect(
      page.getByText(/Sin tickets|Sin resultados|No hay tickets/i).first(),
    ).toBeVisible();
  });
});
