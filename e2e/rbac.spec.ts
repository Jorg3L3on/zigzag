import { test, expect } from '@playwright/test';
import {
  e2eCredentialsSkipReason,
  e2eViewerCredentialsSkipReason,
  ensureTenantCompany,
  hasE2eCredentials,
  hasE2eViewerCredentials,
  login,
  loginAsViewer,
} from './helpers/auth';

test.describe('RBAC browser specs', () => {
  test('viewer cannot see ticket create CTA @390px', async ({ page }) => {
    test.skip(!hasE2eViewerCredentials, e2eViewerCredentialsSkipReason);

    await page.setViewportSize({ width: 390, height: 844 });
    await loginAsViewer(page);
    await page.goto('/tickets');
    await expect(page.getByRole('link', { name: 'Nuevo ticket' })).toHaveCount(0);
  });

  test('admin sees ticket create CTA @768px', async ({ page }) => {
    test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);

    await page.setViewportSize({ width: 768, height: 900 });
    await login(page);
    await ensureTenantCompany(page);
    await page.goto('/tickets');
    await expect(page.getByRole('link', { name: 'Nuevo ticket' })).toBeVisible();
  });

  test('viewer ticket detail hides edit action', async ({ page }) => {
    test.skip(!hasE2eViewerCredentials, e2eViewerCredentialsSkipReason);

    await page.setViewportSize({ width: 390, height: 844 });
    await loginAsViewer(page);
    await page.goto('/tickets');

    const firstTicket = page
      .getByRole('button', { name: /Ver ticket|Editar ticket/i })
      .first();
    if ((await firstTicket.count()) === 0) {
      test.skip(true, 'No tickets in seed for viewer company');
    }

    await firstTicket.click();
    await expect(page.getByRole('link', { name: 'Editar Ticket' })).toHaveCount(0);
  });

  test('viewer clients list hides new client CTA', async ({ page }) => {
    test.skip(!hasE2eViewerCredentials, e2eViewerCredentialsSkipReason);

    await page.setViewportSize({ width: 768, height: 900 });
    await loginAsViewer(page);
    await page.goto('/clients');
    await expect(page.getByRole('link', { name: /Nuevo cliente/i })).toHaveCount(0);
  });
});
