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

const sessionIsSystem = async (page: Page): Promise<boolean> =>
  page.evaluate(async () => {
    const response = await fetch('/api/auth/session');
    const session = (await response.json()) as {
      user?: { company_is_system?: boolean };
    } | null;
    return Boolean(session?.user?.company_is_system);
  });

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

    test('Equipo lists the team as cards and opens Agregar usuario @375px', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto('/company/equipo');

      const forbidden = page.getByText('Acceso denegado');
      if (await forbidden.isVisible().catch(() => false)) {
        test.skip(true, 'Current E2E user cannot read the team');
      }

      await expect(page.getByTestId('team-member-card').first()).toBeVisible();
      // Tenant view: no company column or filters on the cards.
      await expect(
        page.getByTestId('team-member-card').getByText(/Empresa/),
      ).toHaveCount(0);

      const stickyAdd = page
        .getByTestId('mobile-sticky-action-bar')
        .getByRole('button', { name: 'Agregar usuario' });
      if (!(await stickyAdd.isVisible().catch(() => false))) {
        test.skip(true, 'Current E2E user cannot add users');
      }

      await stickyAdd.click();
      const sheet = page.getByRole('dialog', { name: 'Agregar usuario' });
      await expect(sheet).toBeVisible();
      await expect(sheet.getByRole('radio').first()).toBeVisible();
      await expect(sheet.getByLabel('Contraseña inicial')).toBeVisible();
      await sheet.getByRole('button', { name: 'Cancelar' }).click();
      await expect(sheet).toBeHidden();
    });

    test('Equipo actions menu offers Editar, Cambiar rol and Desactivar', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto('/company/equipo');

      const firstMenu = page
        .getByTestId('team-member-row')
        .getByRole('button', { name: /^Acciones de / })
        .first();
      await expect(page.getByTestId('team-member-row').first()).toBeVisible();
      if (!(await firstMenu.isVisible().catch(() => false))) {
        test.skip(true, 'Current E2E user cannot manage the team');
      }

      await firstMenu.click();
      await expect(page.getByRole('menuitem', { name: 'Editar' })).toBeVisible();
      await expect(page.getByRole('menuitem', { name: 'Cambiar rol' })).toBeVisible();
      await expect(page.getByRole('menuitem', { name: /Desactivar/ })).toBeVisible();
      await page.keyboard.press('Escape');

      // The caller's own row cannot be deactivated.
      const selfRow = page.getByTestId('team-member-row').filter({ hasText: '(tú)' });
      if ((await selfRow.count()) > 0) {
        await selfRow.getByRole('button', { name: /^Acciones de / }).click();
        await expect(
          page.getByRole('menuitem', { name: 'Desactivar (eres tú)' }),
        ).toHaveAttribute('data-disabled', '');
        await page.keyboard.press('Escape');
      }
    });

    test('Roles is master-detail with a Ver / Editar matrix on desktop', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto('/company/roles');

      const forbidden = page.getByText('Acceso denegado');
      if (await forbidden.isVisible().catch(() => false)) {
        test.skip(true, 'Current E2E user cannot read roles');
      }

      const firstRole = page.getByTestId('role-list-item').first();
      await expect(firstRole).toBeVisible();
      await firstRole.click();
      await expect(firstRole).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByRole('checkbox', { name: 'Ver Tickets' })).toBeVisible();
      await expect(page.getByRole('checkbox', { name: 'Editar Tickets' })).toBeVisible();
      await expect(
        page.getByRole('checkbox', { name: 'Administrar Mi empresa' }),
      ).toBeVisible();
    });

    test('a role opens a full-screen editor with sticky Guardar rol @375px', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto('/company/roles');

      const forbidden = page.getByText('Acceso denegado');
      if (await forbidden.isVisible().catch(() => false)) {
        test.skip(true, 'Current E2E user cannot read roles');
      }

      await page.getByTestId('role-card').first().click();
      await expect(page).toHaveURL(/\/company\/roles\/\d+$/);
      const appBar = visibleMobileAppBar(page);
      await expect(appBar.getByText('Editar rol')).toBeVisible();
      await expect(page.getByRole('checkbox', { name: 'Ver Tickets' })).toBeVisible();

      const stickySave = page
        .getByTestId('mobile-sticky-action-bar')
        .getByRole('button', { name: 'Guardar rol' });
      if (await page.getByRole('checkbox', { name: 'Ver Tickets' }).isEnabled()) {
        await expect(stickySave).toBeVisible();
      }

      await appBar.getByRole('link', { name: 'Volver a roles' }).click();
      await expect(page).toHaveURL(/\/company\/roles$/);
    });

    test('Datos shows readiness banner and collapsible sections @375px', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto('/company');

      const forbidden = page.getByText('Acceso denegado');
      if (await forbidden.isVisible().catch(() => false)) {
        test.skip(true, 'Current E2E user cannot manage the company');
      }

      await expect(page.getByTestId('company-readiness-banner')).toBeVisible();
      const general = page.getByTestId('company-form-section-general');
      await expect(general.getByLabel('Nombre')).toBeVisible();

      const direccion = page.getByTestId('company-form-section-direccion');
      const direccionToggle = direccion.getByRole('button', { name: /^Dirección/ });
      // Enabled once hydrated in mobile mode; open state is remembered per browser.
      await expect(direccionToggle).toBeEnabled();
      if ((await direccionToggle.getAttribute('aria-expanded')) === 'true') {
        await direccionToggle.click();
      }
      await expect(direccion.getByLabel('Calle')).toBeHidden();
      await direccionToggle.click();
      await expect(direccion.getByLabel('Calle')).toBeVisible();

      await expect(
        page.getByTestId('mobile-sticky-action-bar').getByRole('button', {
          name: 'Guardar cambios',
        }),
      ).toBeVisible();
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

    test('sees the permission catalog under its new name', async ({ page }) => {
      await page.goto('/permissions');
      await expect(page).toHaveURL(/\/permissions/);
      await expect(
        visiblePageHeader(page).getByText('Catálogo de permisos'),
      ).toBeVisible();
    });
  });
});
