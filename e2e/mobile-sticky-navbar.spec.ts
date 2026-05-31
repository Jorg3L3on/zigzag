import { test, expect, devices } from '@playwright/test';
import {
  e2eEmail,
  e2ePassword,
  expectPinnedNavWhileScrolling,
  login,
  scrollPageDown,
} from './helpers/mobile-nav';

test.use({ ...devices['Pixel 5'] });

test.describe('Mobile sticky navigation', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    test.skip(
      !e2eEmail || !e2ePassword,
      'Set E2E_EMAIL and E2E_PASSWORD to run authenticated mobile nav E2E',
    );

    await login(page);
  });

  test.describe('Fixed mobile app bar (detail & form pages)', () => {
    const staticAppBarPages = [
      {
        name: 'account',
        path: '/dashboard/account',
        title: 'Mi cuenta',
      },
      {
        name: 'new client',
        path: '/dashboard/clients/new',
        title: 'Nuevo cliente',
      },
      {
        name: 'new ticket',
        path: '/dashboard/tickets/create',
        title: 'Nuevo ticket',
      },
    ] as const;

    for (const { name, path, title } of staticAppBarPages) {
      test(`${name} keeps mobile app bar fixed while scrolling`, async ({
        page,
      }) => {
        await page.goto(path);

        await expect(page.getByTestId('mobile-app-bar').getByText(title)).toBeVisible();
        const appBar = page.getByTestId('mobile-app-bar');
        await expectPinnedNavWhileScrolling(page, appBar, 'fixed');
      });
    }

    test('ticket detail keeps back navigation reachable after scroll', async ({
      page,
    }) => {
      await page.goto('/dashboard/tickets');
      await page
        .getByRole('button', { name: /Ver ticket|Editar ticket/i })
        .first()
        .click();
      await page.waitForURL(/\/dashboard\/tickets\/\d+/);

      const appBar = page.getByTestId('mobile-app-bar');
      await expect(appBar).toBeVisible();
      await scrollPageDown(page);
      await expect(appBar).toBeVisible();

      await appBar.getByRole('link', { name: 'Volver' }).click();
      await expect(page).toHaveURL(/\/dashboard\/tickets$/);
    });

    test('ticket edit keeps mobile app bar fixed while scrolling', async ({
      page,
    }) => {
      await page.goto('/dashboard/tickets');
      const editButton = page
        .getByRole('button', { name: /Editar ticket/i })
        .first();
      if (await editButton.isVisible().catch(() => false)) {
        await editButton.click();
        await page.waitForURL(/\/dashboard\/tickets\/\d+\/edit/);
      } else {
        await page
          .getByRole('button', { name: /Ver ticket/i })
          .first()
          .click();
        await page.waitForURL(/\/dashboard\/tickets\/\d+$/);
        const ticketId = page.url().match(/\/tickets\/(\d+)$/)?.[1];
        test.skip(!ticketId, 'No ticket available for edit nav test');
        await page.goto(`/dashboard/tickets/${ticketId}/edit`);
      }

      const appBar = page.getByTestId('mobile-app-bar');
      await expectPinnedNavWhileScrolling(page, appBar, 'fixed');
    });

    test('ticket services step keeps mobile app bar fixed while scrolling', async ({
      page,
    }) => {
      await page.goto('/dashboard/tickets');
      const editButton = page
        .getByRole('button', { name: /Editar ticket/i })
        .first();
      if (await editButton.isVisible().catch(() => false)) {
        await editButton.click();
        await page.waitForURL(/\/dashboard\/tickets\/\d+\/edit/);
      } else {
        await page
          .getByRole('button', { name: /Ver ticket/i })
          .first()
          .click();
        await page.waitForURL(/\/dashboard\/tickets\/\d+$/);
      }

      const ticketId =
        page.url().match(/\/tickets\/(\d+)(?:\/edit)?/)?.[1] ?? null;
      test.skip(!ticketId, 'No ticket available for services step nav test');

      await page.goto(`/dashboard/tickets/${ticketId}/services`);

      const appBar = page.getByTestId('mobile-app-bar');
      await expect(appBar).toBeVisible();
      await expect(appBar.getByText('Servicios')).toBeVisible();
      await expectPinnedNavWhileScrolling(page, appBar, 'fixed');
    });

    test('client edit keeps mobile app bar fixed while scrolling', async ({
      page,
    }) => {
      await page.goto('/dashboard/clients');
      await page
        .getByRole('button', { name: /Editar cliente/i })
        .first()
        .click();
      await page.waitForURL(/\/dashboard\/clients\/\d+\/edit/);

      const appBar = page.getByTestId('mobile-app-bar');
      await expectPinnedNavWhileScrolling(page, appBar, 'fixed');
    });

    test('service edit keeps mobile app bar fixed while scrolling', async ({
      page,
    }) => {
      await page.goto('/dashboard/services');
      await page
        .getByRole('button', { name: /Editar servicio/i })
        .first()
        .click();
      await page.waitForURL(/\/dashboard\/services\/\d+\/edit/);

      const appBar = page.getByTestId('mobile-app-bar');
      await expectPinnedNavWhileScrolling(page, appBar, 'fixed');
    });

    test('company edit keeps mobile app bar fixed while scrolling', async ({
      page,
    }) => {
      await page.goto('/dashboard/companies');
      const forbidden = page.getByText('Acceso denegado');
      if (await forbidden.isVisible().catch(() => false)) {
        test.skip(true, 'Current E2E user cannot access companies module');
      }

      await page
        .getByRole('button', { name: /^Editar /i })
        .first()
        .click();
      await page.waitForURL(/\/dashboard\/companies\/\d+\/edit/);

      const appBar = page.getByTestId('mobile-app-bar');
      await expectPinnedNavWhileScrolling(page, appBar, 'fixed');
    });

    test('new company keeps mobile app bar fixed while scrolling', async ({
      page,
    }) => {
      await page.goto('/dashboard/companies/new');
      const forbidden = page.getByText('Acceso denegado');
      if (await forbidden.isVisible().catch(() => false)) {
        test.skip(true, 'Current E2E user cannot access companies module');
      }

      const appBar = page.getByTestId('mobile-app-bar');
      await expect(appBar).toBeVisible();
      await expect(appBar.getByText('Nueva empresa')).toBeVisible();
      await expectPinnedNavWhileScrolling(page, appBar, 'fixed');
    });
  });

  test.describe('Sticky page header (list & dashboard modules)', () => {
    const listModulePages = [
      { name: 'dashboard', path: '/dashboard', label: 'Dashboard' },
      { name: 'tickets', path: '/dashboard/tickets', label: 'Tickets' },
      { name: 'clients', path: '/dashboard/clients', label: 'Clientes' },
      { name: 'services', path: '/dashboard/services', label: 'Servicios' },
      { name: 'users', path: '/dashboard/users', label: 'Usuarios' },
      { name: 'roles', path: '/dashboard/roles', label: 'Roles' },
      {
        name: 'permissions',
        path: '/dashboard/permissions',
        label: 'Permisos',
      },
      {
        name: 'service schedules',
        path: '/dashboard/service-schedules',
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

    test('companies list keeps page header sticky while scrolling', async ({
      page,
    }) => {
      await page.goto('/dashboard/companies');

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
