import { test, expect, type Page } from '@playwright/test';
import {
  e2eCredentialsSkipReason,
  ensureTenantCompany,
  hasE2eCredentials,
  login,
} from './helpers/auth';

/** ZIG-I26-3: the desktop sidebar keeps its folded state across reloads. */

const sidebar = (page: Page) => page.locator('div.peer[data-state]').first();
const trigger = (page: Page) =>
  page.locator('[data-sidebar="trigger"]').filter({ visible: true }).first();

test.describe('Desktop sidebar state', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
    await login(page);
    await ensureTenantCompany(page);
  });

  test('folding survives a reload, and the trigger says which way it goes', async ({ page }) => {
    const hydrationErrors: string[] = [];
    page.on('console', (message) => {
      if (/hydrat/i.test(message.text())) hydrationErrors.push(message.text());
    });

    await page.goto('/tickets');
    await expect(sidebar(page)).toHaveAttribute('data-state', 'expanded', { timeout: 30_000 });

    await trigger(page).hover();
    await expect(page.getByRole('tooltip', { name: 'Cerrar menú' })).toBeVisible();
    await expect(trigger(page)).toHaveAttribute('aria-label', 'Cerrar menú');

    await trigger(page).click();
    await expect(sidebar(page)).toHaveAttribute('data-state', 'collapsed');

    await page.reload();
    await expect(sidebar(page)).toHaveAttribute('data-state', 'collapsed', { timeout: 30_000 });
    await expect(trigger(page)).toHaveAttribute('aria-label', 'Abrir menú');
    await trigger(page).hover();
    await expect(page.getByRole('tooltip', { name: 'Abrir menú' })).toBeVisible();

    // The company logo is not clipped in icon mode: its tile fits inside the clipping box
    // (one company: the plain block; several: the switcher button).
    const brand = page
      .locator('[aria-label^="Empresa:"]')
      .or(page.locator('[data-sidebar="header"] [data-sidebar="menu-button"]'))
      .first();
    const box = await brand.boundingBox();
    const tile = await brand.locator('> div').first().boundingBox();
    expect(box && tile).toBeTruthy();
    expect(tile!.x).toBeGreaterThanOrEqual(box!.x - 0.5);
    expect(tile!.y).toBeGreaterThanOrEqual(box!.y - 0.5);
    expect(tile!.x + tile!.width).toBeLessThanOrEqual(box!.x + box!.width + 0.5);
    expect(tile!.y + tile!.height).toBeLessThanOrEqual(box!.y + box!.height + 0.5);

    await trigger(page).click();
    await expect(sidebar(page)).toHaveAttribute('data-state', 'expanded');
    await page.reload();
    await expect(sidebar(page)).toHaveAttribute('data-state', 'expanded', { timeout: 30_000 });

    expect(hydrationErrors).toEqual([]);
  });
});
