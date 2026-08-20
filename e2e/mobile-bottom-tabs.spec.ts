import { test, expect } from '@playwright/test';
import {
  e2eCredentialsSkipReason,
  ensureTenantCompany,
  hasE2eCredentials,
  login,
} from './helpers/auth';
import { visibleMobileStickyActionBar } from './helpers/mobile-chrome';

test.describe('Mobile bottom tabs', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
    await login(page);
    await ensureTenantCompany(page);
  });

  test('shows Hoy / Anotar / Clientes / Más on dashboard', async ({ page }) => {
    await page.goto('/dashboard');

    const tabBar = page.getByTestId('mobile-bottom-tab-bar');
    await expect(tabBar).toBeVisible();
    await expect(tabBar.getByRole('link', { name: 'Hoy' })).toBeVisible();
    await expect(tabBar.getByRole('link', { name: 'Anotar' })).toBeVisible();
    await expect(tabBar.getByRole('link', { name: 'Clientes' })).toBeVisible();
    await expect(tabBar.getByRole('button', { name: /Más/i })).toBeVisible();
    await expect(tabBar.getByRole('link', { name: 'Hoy' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  test('navigates Anotar to /anotar and Clientes', async ({ page }) => {
    await page.goto('/dashboard');

    const tabBar = page.getByTestId('mobile-bottom-tab-bar');
    await tabBar.getByRole('link', { name: 'Clientes' }).click();
    await expect(page).toHaveURL(/\/clients/);
    await expect(tabBar.getByRole('link', { name: 'Clientes' })).toHaveAttribute(
      'aria-current',
      'page',
    );

    await tabBar.getByRole('link', { name: 'Anotar' }).click();
    await expect(page).toHaveURL(/\/anotar/);
  });

  test('does not treat tickets list as a primary tab destination', async ({
    page,
  }) => {
    await page.goto('/tickets');

    const tabBar = page.getByTestId('mobile-bottom-tab-bar');
    await expect(tabBar).toBeVisible();
    await expect(tabBar.getByRole('link', { name: 'Tickets' })).toHaveCount(0);
    await expect(tabBar.getByRole('link', { name: 'Hoy' })).not.toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  test('hides tabs on Anotar when sticky action bar is present', async ({
    page,
  }) => {
    await page.goto('/anotar');

    await expect(visibleMobileStickyActionBar(page)).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId('mobile-bottom-tab-bar')).toHaveCount(0);
  });

  test('hides tabs on ticket edit when sticky action bar is present', async ({
    page,
  }) => {
    await page.goto('/tickets');

    const editButton = page
      .getByRole('button', { name: /Editar ticket/i })
      .first();
    if (!(await editButton.isVisible().catch(() => false))) {
      test.skip(true, 'No editable ticket available for sticky action test');
      return;
    }

    await editButton.click();
    await page.waitForURL(/\/tickets\/\d+\/edit/, { timeout: 30_000 });

    await expect(visibleMobileStickyActionBar(page)).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId('mobile-bottom-tab-bar')).toHaveCount(0);
  });

  test('Más opens the existing navigation sheet', async ({ page }) => {
    await page.goto('/dashboard');

    const tabBar = page.getByTestId('mobile-bottom-tab-bar');
    await expect(tabBar).toBeVisible();
    await tabBar.getByRole('button', { name: /Más/i }).click();

    const navDialog = page.getByRole('dialog', { name: 'Menú de navegación' });
    await expect(navDialog).toBeVisible();
    await expect(navDialog.getByRole('link', { name: 'Inicio' })).toBeVisible();
    await expect(navDialog.getByRole('link', { name: 'Tickets' })).toBeVisible();
  });
});
