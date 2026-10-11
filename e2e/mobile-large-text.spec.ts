import { test, expect } from '@playwright/test';
import { e2eCredentialsSkipReason, ensureTenantCompany, hasE2eCredentials, login } from './helpers/auth';
import { expectLayoutIntact } from './helpers/layout';

/** ZIG-I18-15: Texto grande in Más, 18px root, no overflow on the primary screens. */
test.describe('Texto grande (ZIG-I18-15)', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
    await login(page);
    await ensureTenantCompany(page);
  });

  test.setTimeout(120_000);

  for (const width of [375, 333]) {
    test(`switch persists and screens fit at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/dashboard');
      await page.getByRole('button', { name: /Más opciones de navegación/ }).click();
      const toggle = page.getByRole('switch', { name: 'Texto grande' });
      const box = await toggle.boundingBox();
      expect(box).not.toBeNull();
      await toggle.click();
      await expect(page.locator('html')).toHaveAttribute('data-text-size', 'large');
      expect(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe('18px');

      // Survives a reload, set before first paint.
      await page.reload();
      await expect(page.locator('html')).toHaveAttribute('data-text-size', 'large');

      for (const path of ['/dashboard', '/tickets', '/cobranza', '/clients', '/anotar']) {
        await page.goto(path);
        await expect(page.locator('main').first()).toBeVisible({ timeout: 20_000 });
        await page.waitForTimeout(1500);
        await expectLayoutIntact(page, `${path} @${width} large`);
      }

      await page.goto('/dashboard');
      await page.getByRole('button', { name: /Más opciones de navegación/ }).click();
      await page.getByRole('switch', { name: 'Texto grande' }).click();
      await expect(page.locator('html')).not.toHaveAttribute('data-text-size', 'large');
    });
  }
});
