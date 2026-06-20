import { test, expect } from '@playwright/test';
import {
  e2eSystemCredentialsSkipReason,
  ensureSystemCompany,
  hasE2eSystemCredentials,
  loginAsSystemUser,
  loginAsViewer,
  e2eViewerCredentialsSkipReason,
  hasE2eViewerCredentials,
} from './helpers/auth';

test.describe('Audit log access', () => {
  test('system admin can open audit page', async ({ page }) => {
    test.skip(!hasE2eSystemCredentials, e2eSystemCredentialsSkipReason);

    await loginAsSystemUser(page);
    await ensureSystemCompany(page);
    await page.goto('/audit');

    await expect(page.getByText('Auditoría', { exact: true }).first()).toBeVisible();
    await expect(
      page.getByLabel('Buscar eventos de auditoría'),
    ).toBeVisible();
  });

  test('non-system viewer is forbidden on audit page', async ({ page }) => {
    test.skip(!hasE2eViewerCredentials, e2eViewerCredentialsSkipReason);

    await loginAsViewer(page);
    await page.goto('/audit');
    await expect(page).toHaveURL(/\/forbidden/);
  });
});
