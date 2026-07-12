import { test, expect } from '@playwright/test';
import {
  e2eCredentialsSkipReason,
  ensureTenantCompany,
  hasE2eCredentials,
  login,
} from './helpers/auth';

const offlineBannerText = /Sin conexión a internet/i;
const recoveredBannerText = /Conexión restablecida/i;

test.describe('Mobile offline graceful degradation', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
    await login(page);
    await ensureTenantCompany(page);
  });

  test('shows offline banner when network is lost and clears after reconnect', async ({
    page,
    context,
  }) => {
    await page.goto('/dashboard');
    await expect(page.getByText(offlineBannerText)).toHaveCount(0);

    await context.setOffline(true);
    const offlineBanner = page.getByRole('status').filter({
      hasText: offlineBannerText,
    });
    await expect(offlineBanner).toBeVisible();
    await expect(offlineBanner).toHaveAttribute('aria-live', 'assertive');

    await context.setOffline(false);
    await expect(offlineBanner).toBeHidden({ timeout: 10_000 });
    await expect(page.getByText(recoveredBannerText)).toBeHidden({
      timeout: 10_000,
    });
  });

  test('keeps dashboard shell visible while offline after an online visit', async ({
    page,
    context,
  }) => {
    await page.goto('/dashboard');
    await expect(page.getByText('Dashboard').first()).toBeVisible();

    await context.setOffline(true);
    await expect(page.getByText(offlineBannerText)).toBeVisible();
    await expect(page.getByText('Dashboard').first()).toBeVisible();
  });
});
