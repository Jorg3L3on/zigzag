import { test, expect, type Page } from '@playwright/test';
import {
  e2eCredentialsSkipReason,
  ensureTenantCompany,
  hasE2eCredentials,
  login,
} from './helpers/auth';
import { visibleMobileAppBar, visiblePageHeader } from './helpers/mobile-chrome';

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(async () =>
      page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth + 1,
      ),
    )
    .toBe(true);
}

test.describe('Mobile dashboard redesign', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
    await login(page);
    await ensureTenantCompany(page);
  });

  test('shows mobile-first client form chrome', async ({ page }) => {
    await page.goto('/clients/new');

    await expect(visibleMobileAppBar(page).getByText('Nuevo cliente')).toBeVisible();
    // Responsive layouts may mount duplicate section titles; scope to first.
    await expect(page.getByText('Información del cliente').first()).toBeVisible();
    await expect(page.getByLabel('Nombre').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Crear' }).first()).toBeVisible();
  });

  test('shows mobile-first admin list controls', async ({ page }) => {
    await page.goto('/users');

    const forbidden = page.getByText('Acceso denegado');
    if (await forbidden.isVisible().catch(() => false)) {
      test.skip(true, 'Current E2E user cannot access users module');
    }

    await expect(visiblePageHeader(page).getByText('Usuarios')).toBeVisible();
    await expect(
      page.getByRole('textbox', { name: 'Buscar usuarios' }).first(),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /Filtrar correo:/i })).toHaveCount(3);
    await expect(page.getByText(/de \d+ usuarios/).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('shows mobile-first account page chrome', async ({ page }) => {
    await page.goto('/account');

    await expect(visibleMobileAppBar(page).getByText('Mi cuenta')).toBeVisible();
    await expect(page.getByText('Perfil y empresa').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Empresa' })).toBeVisible();
  });
});
