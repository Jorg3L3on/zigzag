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

test.describe('Mobile ticket screens', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
    await login(page);
    await ensureTenantCompany(page);
  });

  test('shows mobile-first tickets list controls', async ({ page }) => {
    await page.goto('/tickets');

    await expect(visiblePageHeader(page).getByText('Tickets')).toBeVisible();
    await expect(page.getByPlaceholder('Buscar tickets...')).toBeVisible();
    await expect(page.getByRole('button', { name: /Abrir filtros/ })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Nuevo ticket' })).toBeVisible();
    await expect(page.getByText(/de \d+ tickets/)).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('shows mobile-first create ticket flow', async ({ page }) => {
    await page.goto('/tickets/create');

    await expect(visibleMobileAppBar(page).getByText('Nuevo ticket')).toBeVisible();
    // Responsive layouts may mount duplicate step chrome; scope to first.
    await expect(page.getByText('Paso 1 de 3').first()).toBeVisible();
    await expect(page.getByText('Información del cliente').first()).toBeVisible();
    await expect(page.getByText('Seleccionar cliente').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nuevo cliente' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Crear', exact: true }).first()).toBeVisible();
  });
});
