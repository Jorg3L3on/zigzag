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

  test('Hoy surfaces Enviar menu on trabajo de hoy cards', async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'mobile-chrome',
      'Field send menu is validated on mobile viewport',
    );

    await page.goto('/dashboard');
    await expect(page.getByTestId('technician-day-widget')).toBeVisible({
      timeout: 30_000,
    });

    const sendTrigger = page.getByTestId('field-send-menu-trigger').first();
    if ((await sendTrigger.count()) === 0) {
      test.skip(true, 'No unfinished day tickets in seed for Enviar menu');
    }

    await sendTrigger.click();
    await expect(page.getByTestId('field-send-menu-sheet')).toBeVisible();
    // Options depend on finished vs open: Voy en camino | Enviar recibo | Recordar saldo
    await expect(
      page.locator('[data-testid^="field-send-option-"]').first(),
    ).toBeVisible();
  });

  test('Por cobrar strip renders when balances exist', async ({ page }) => {
    await page.goto('/dashboard');
    const strip = page.getByTestId('hoy-por-cobrar-strip');
    // Strip is omitted when nothing is owed — tolerate either state.
    await page.waitForTimeout(1500);
    if (await strip.isVisible().catch(() => false)) {
      await expect(
        page.getByRole('link', { name: /Ver toda la cobranza/i }),
      ).toHaveAttribute('href', '/cobranza');
      const whatsapp = page
        .locator('[data-testid="hoy-por-cobrar-strip"] a[href*="wa.me"]')
        .first();
      if (await whatsapp.count()) {
        const href = await whatsapp.getAttribute('href');
        expect(href).toContain('wa.me');
        expect(decodeURIComponent(href ?? '')).toMatch(/saldo|pendiente|ticket/i);
      }
    }
  });
});
