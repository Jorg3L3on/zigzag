import { test, expect } from '@playwright/test';
import {
  e2eCredentialsSkipReason,
  hasE2eCredentials,
  login,
} from './helpers/auth';

test.describe('Dashboard', () => {
  test('redirects unauthenticated visitors to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('shows dashboard headings after login', async ({ page }) => {
    test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);

    await login(page);

    await expect(page.getByRole('link', { name: 'Inicio' })).toBeVisible();
    await expect(page.locator('#dashboard-revenue-chart-title')).toBeVisible();
    await expect(page.getByText('Tickets activos', { exact: true })).toBeVisible();
  });
});
