import { test, expect, type Page } from '@playwright/test';
import {
  e2eCredentialsSkipReason,
  e2eSystemCredentialsSkipReason,
  hasE2eCredentials,
  hasE2eSystemCredentials,
  login,
  loginAsSystemUser,
} from './helpers/auth';
import { visibleMobileAppBar, visiblePageHeader } from './helpers/mobile-chrome';

const hubTabs = (page: Page) => page.getByTestId('company-hub-tabs');

const visibleHubTab = (page: Page, name: string) =>
  hubTabs(page)
    .getByRole('link', { name: new RegExp(`^${name}`) })
    .filter({ visible: true })
    .first();

const sessionIsSystem = async (page: Page): Promise<boolean> => {
  const response = await page.request.get('/api/auth/session');
  const session = (await response.json()) as {
    user?: { company_is_system?: boolean };
  };
  return Boolean(session.user?.company_is_system);
};

/** ZIG-I3-1 — Mi empresa hub shell: Datos · Equipo · Roles. */
test.describe('Mi empresa hub', () => {
  test.describe('Tenant user', () => {
    test.beforeEach(async ({ page }) => {
      test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
      await login(page);
    });

    test('shows the segmented control and switches tabs @375px', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto('/company/equipo');

      const forbidden = page.getByText('Acceso denegado');
      if (await forbidden.isVisible().catch(() => false)) {
        test.skip(true, 'Current E2E user cannot read the team');
      }

      await expect(visibleMobileAppBar(page).getByText('Mi empresa')).toBeVisible();
      const equipo = visibleHubTab(page, 'Equipo');
      await expect(equipo).toBeVisible();
      await expect(equipo).toHaveAttribute('aria-current', 'page');

      const datos = visibleHubTab(page, 'Datos');
      if (await datos.isVisible().catch(() => false)) {
        await datos.click();
        await expect(page).toHaveURL(/\/company$/);
        await expect(visibleHubTab(page, 'Datos')).toHaveAttribute(
          'aria-current',
          'page',
        );
      }
    });

    test('shows underline tabs with counts and breadcrumb on desktop', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto('/company/equipo');

      const forbidden = page.getByText('Acceso denegado');
      if (await forbidden.isVisible().catch(() => false)) {
        test.skip(true, 'Current E2E user cannot read the team');
      }

      const equipo = visibleHubTab(page, 'Equipo');
      await expect(equipo).toBeVisible();
      await expect(equipo).toHaveText(/Equipo\s*\d+/);
      await expect(visiblePageHeader(page).getByText('Equipo')).toBeVisible();
    });

    test('redirects tenant users from the old admin pages to the hub', async ({
      page,
    }) => {
      test.skip(
        await sessionIsSystem(page),
        'E2E_EMAIL is a system user; old pages stay for operators',
      );

      await page.goto('/users');
      await expect(page).toHaveURL(/\/company\/equipo|\/forbidden/);

      await page.goto('/roles');
      await expect(page).toHaveURL(/\/company\/roles|\/forbidden/);

      await page.goto('/permissions');
      await expect(page).toHaveURL(/\/company\/roles|\/forbidden/);
    });
  });

  test.describe('System operator', () => {
    test.beforeEach(async ({ page }) => {
      test.skip(!hasE2eSystemCredentials, e2eSystemCredentialsSkipReason);
      await loginAsSystemUser(page);
    });

    test('keeps the standalone Usuarios page', async ({ page }) => {
      await page.goto('/users');
      await expect(page).toHaveURL(/\/users/);
      await expect(visiblePageHeader(page).getByText('Usuarios')).toBeVisible();
    });
  });
});
