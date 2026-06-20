import { test, expect } from '@playwright/test';
import {
  ensureSystemCompany,
  expectPinnedNavWhileScrolling,
  login,
  loginAsSystemUser,
  scrollPageDown,
} from './helpers/mobile-nav';
import {
  e2eCredentialsSkipReason,
  e2eSystemCredentialsSkipReason,
  hasE2eCredentials,
  hasE2eSystemCredentials,
} from './helpers/auth';

test.describe('Mobile sticky navigation', () => {
  test.describe.configure({ mode: 'serial' });

  test.describe('Tenant operator flows', () => {
    test.beforeEach(async ({ page }) => {
      test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
      await login(page);
    });

    test.describe('Fixed mobile app bar (detail & form pages)', () => {
      const staticAppBarPages = [
        {
          name: 'account',
          path: '/account',
          title: 'Mi cuenta',
        },
        {
          name: 'new client',
          path: '/clients/new',
          title: 'Nuevo cliente',
        },
        {
          name: 'new ticket',
          path: '/tickets/create',
          title: 'Nuevo ticket',
        },
      ] as const;

      for (const { name, path, title } of staticAppBarPages) {
        test(`${name} keeps mobile app bar fixed while scrolling`, async ({
          page,
        }) => {
          await page.goto(path);

          await expect(
            page.getByTestId('mobile-app-bar').getByText(title),
          ).toBeVisible();
          const appBar = page.getByTestId('mobile-app-bar');
          await expectPinnedNavWhileScrolling(page, appBar, 'fixed');
        });
      }

      test('ticket detail keeps back navigation reachable after scroll', async ({
        page,
      }) => {
        await page.goto('/tickets');
        await page
          .getByRole('button', { name: /Ver ticket|Editar ticket/i })
          .first()
          .click();
        await page.waitForURL(/\/tickets\/\d+/);

        const appBar = page.getByTestId('mobile-app-bar');
        await expect(appBar).toBeVisible();
        await scrollPageDown(page);
        await expect(appBar).toBeVisible();

        await appBar.getByRole('link', { name: 'Volver' }).click();
        await expect(page).toHaveURL(/\/tickets$/);
      });

      test('ticket edit keeps mobile app bar fixed while scrolling', async ({
        page,
      }) => {
        await page.goto('/tickets');
        const editButton = page
          .getByRole('button', { name: /Editar ticket/i })
          .first();
        if (await editButton.isVisible().catch(() => false)) {
          await editButton.click();
          await page.waitForURL(/\/tickets\/\d+\/edit/);
        } else {
          await page
            .getByRole('button', { name: /Ver ticket/i })
            .first()
            .click();
          await page.waitForURL(/\/tickets\/\d+$/);
          const ticketId = page.url().match(/\/tickets\/(\d+)$/)?.[1];
          test.skip(!ticketId, 'No ticket available for edit nav test');
          await page.goto(`/tickets/${ticketId}/edit`);
        }

        const appBar = page.getByTestId('mobile-app-bar');
        await expectPinnedNavWhileScrolling(page, appBar, 'fixed');
      });

      test('ticket services step keeps mobile app bar fixed while scrolling', async ({
        page,
      }) => {
        await page.goto('/tickets');
        const editButton = page
          .getByRole('button', { name: /Editar ticket/i })
          .first();
        if (await editButton.isVisible().catch(() => false)) {
          await editButton.click();
          await page.waitForURL(/\/tickets\/\d+\/edit/);
        } else {
          await page
            .getByRole('button', { name: /Ver ticket/i })
            .first()
            .click();
          await page.waitForURL(/\/tickets\/\d+$/);
        }

        const ticketId =
          page.url().match(/\/tickets\/(\d+)(?:\/edit)?/)?.[1] ?? null;
        test.skip(!ticketId, 'No ticket available for services step nav test');

        await page.goto(`/tickets/${ticketId}/services`);

        const appBar = page.getByTestId('mobile-app-bar');
        await expect(appBar).toBeVisible();
        await expect(appBar.getByText('Servicios')).toBeVisible();
        await expectPinnedNavWhileScrolling(page, appBar, 'fixed');
      });

      test('client edit keeps mobile app bar fixed while scrolling', async ({
        page,
      }) => {
        await page.goto('/clients');
        await page
          .getByRole('button', { name: /Editar cliente/i })
          .first()
          .click();
        await page.waitForURL(/\/clients\/\d+\/edit/);

        const appBar = page.getByTestId('mobile-app-bar');
        await expectPinnedNavWhileScrolling(page, appBar, 'fixed');
      });

      test('service edit keeps mobile app bar fixed while scrolling', async ({
        page,
      }) => {
        await page.goto('/services');
        await page
          .getByRole('button', { name: /Editar servicio/i })
          .first()
          .click();
        await page.waitForURL(/\/services\/\d+\/edit/);

        const appBar = page.getByTestId('mobile-app-bar');
        await expectPinnedNavWhileScrolling(page, appBar, 'fixed');
      });
    });

    test.describe('Sticky page header (list & dashboard modules)', () => {
      const listModulePages = [
        { name: 'dashboard', path: '/dashboard', label: 'Dashboard' },
        { name: 'tickets', path: '/tickets', label: 'Tickets' },
        { name: 'clients', path: '/clients', label: 'Clientes' },
        { name: 'services', path: '/services', label: 'Servicios' },
        { name: 'users', path: '/users', label: 'Usuarios' },
        { name: 'roles', path: '/roles', label: 'Roles' },
        {
          name: 'permissions',
          path: '/permissions',
          label: 'Permisos',
        },
        {
          name: 'service schedules',
          path: '/service-schedules',
          label: 'Recordatorios de servicio',
        },
      ] as const;

      for (const { name, path, label } of listModulePages) {
        test(`${name} keeps page header sticky while scrolling`, async ({
          page,
        }) => {
          await page.goto(path);

          const forbidden = page.getByText('Acceso denegado');
          if (await forbidden.isVisible().catch(() => false)) {
            test.skip(true, `Current E2E user cannot access ${name}`);
          }

          const pageHeader = page.getByTestId('page-header');
          await expect(pageHeader).toBeVisible();
          await expect(pageHeader.getByText(label)).toBeVisible();
          await expectPinnedNavWhileScrolling(page, pageHeader, 'sticky');
        });
      }
    });
  });

  test.describe('System operator flows', () => {
    test.beforeEach(async ({ page }) => {
      test.skip(!hasE2eSystemCredentials, e2eSystemCredentialsSkipReason);
      await loginAsSystemUser(page);
      await ensureSystemCompany(page);
    });

    test('company edit keeps mobile app bar fixed while scrolling', async ({
      page,
    }) => {
      await page.goto('/companies');

      const forbidden = page.getByText('Acceso denegado');
      if (await forbidden.isVisible().catch(() => false)) {
        test.skip(true, 'Current E2E user cannot access companies module');
      }

      const editCompany = page.getByRole('button', { name: /Editar empresa/i });
      if ((await editCompany.count()) === 0) {
        test.skip(true, 'No editable companies available for this user');
      }

      await editCompany.first().click();
      await page.waitForURL(/\/companies\/\d+\/edit/, {
        timeout: 30_000,
      });

      const appBar = page.getByTestId('mobile-app-bar');
      await expectPinnedNavWhileScrolling(page, appBar, 'fixed');
    });

    test('new company keeps mobile app bar fixed while scrolling', async ({
      page,
    }) => {
      await page.goto('/companies/new');
      const forbidden = page.getByText('Acceso denegado');
      if (await forbidden.isVisible().catch(() => false)) {
        test.skip(true, 'Current E2E user cannot access companies module');
      }

      const appBar = page.getByTestId('mobile-app-bar');
      await expect(appBar).toBeVisible();
      await expect(appBar.getByText('Nueva empresa')).toBeVisible();
      await expectPinnedNavWhileScrolling(page, appBar, 'fixed');
    });

    test('companies list keeps page header sticky while scrolling', async ({
      page,
    }) => {
      await page.goto('/companies');

      const forbidden = page.getByText('Acceso denegado');
      if (await forbidden.isVisible().catch(() => false)) {
        test.skip(true, 'Current E2E user cannot access companies module');
      }

      const pageHeader = page.getByTestId('page-header');
      await expect(pageHeader).toBeVisible();
      await expect(pageHeader.getByText('Empresas')).toBeVisible();
      await expectPinnedNavWhileScrolling(page, pageHeader, 'sticky');
    });
  });
});
