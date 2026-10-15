import { test, expect } from '@playwright/test';
import {
  e2eCredentialsSkipReason,
  ensureTenantCompany,
  hasE2eCredentials,
  login,
} from './helpers/auth';

/**
 * ZIG-I21-4: Más › Cuenta offers "Instalar ZigZag" on Android once Chrome
 * fires `beforeinstallprompt`. Playwright's Chromium never fires it on its
 * own, so the test dispatches one with a stubbed `prompt()` that records the
 * call and answers "accepted". Read-only: nothing is saved.
 */
test.describe('Install ZigZag from Mi cuenta (Android)', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
    await page.setViewportSize({ width: 375, height: 812 });
    await login(page);
    await ensureTenantCompany(page);
  });

  test('Más › Cuenta shows the install card and one tap opens Chrome’s dialog', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByTestId('mobile-bottom-tab-bar').getByRole('button', { name: /Más/i }).click();
    const navDialog = page.getByRole('dialog', { name: 'Menú de navegación' });
    await expect(navDialog).toBeVisible();
    await navDialog.getByRole('button', { name: /@/ }).click();
    await page.getByRole('menuitem', { name: 'Cuenta' }).click();
    await expect(page).toHaveURL(/\/account/);
    // The Más sheet closes like it does for the nav links.
    await expect(navDialog).toBeHidden();

    // No install offer until Chrome says the app is installable.
    await expect(page.getByTestId('pwa-install-card')).toHaveCount(0);

    await page.evaluate(() => {
      const event = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
        prompt: () => Promise<void>;
        userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
      };
      event.prompt = async () => {
        (window as unknown as { __promptCalls: number }).__promptCalls =
          ((window as unknown as { __promptCalls?: number }).__promptCalls ?? 0) + 1;
      };
      event.userChoice = Promise.resolve({ outcome: 'accepted' });
      window.dispatchEvent(event);
    });

    const card = page.getByTestId('pwa-install-card');
    await expect(card).toBeVisible();
    await expect(card).toContainText('sin la barra del navegador');
    const button = page.getByTestId('pwa-install-button');
    await button.scrollIntoViewIfNeeded();
    await expect(button).toBeVisible();

    // Big enough to tap and fully inside what the user sees at 375 px.
    const layout = await button.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      const viewport = window.visualViewport!;
      return {
        height: rect.height,
        left: rect.left,
        right: rect.right,
        viewportWidth: viewport.width,
        scrollWidth: document.documentElement.scrollWidth,
      };
    });
    expect(layout.height).toBeGreaterThanOrEqual(44);
    expect(layout.left).toBeGreaterThanOrEqual(0);
    expect(layout.right).toBeLessThanOrEqual(layout.viewportWidth);
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.viewportWidth);

    await button.click();
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __promptCalls?: number }).__promptCalls ?? 0))
      .toBe(1);
    await expect(page.getByTestId('pwa-install-card')).toHaveCount(0);
  });
});
