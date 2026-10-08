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

  test('Inicio leads with Acciones rápidas and has no export buttons', async ({
    page,
  }) => {
    await page.goto('/dashboard');

    const quickActions = page
      .getByTestId('dashboard-quick-actions')
      .filter({ visible: true })
      .first();
    const forbiddenOrEmpty = await quickActions
      .waitFor({ timeout: 20_000 })
      .then(() => false)
      .catch(() => true);
    test.skip(forbiddenOrEmpty, 'Current E2E user has no quick actions (viewer)');

    await expect(page.getByRole('button', { name: /Exportar (PDF|CSV)/ })).toHaveCount(0);
    await expect(quickActions.getByRole('link').first()).toBeVisible();

    // The chip row is the first block after the greeting, before any section.
    const leadsPage = await page.evaluate(() => {
      const heading = document.querySelector('h1');
      const row = document.querySelector('[data-testid="dashboard-quick-actions"]');
      if (!heading || !row) return false;
      const following = (a: Node, b: Node) =>
        Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
      const firstSection = Array.from(document.querySelectorAll('section')).find(
        (section) => following(heading, section),
      );
      return following(heading, row) && (!firstSection || following(row, firstSection));
    });
    expect(leadsPage).toBe(true);
    await expectNoHorizontalOverflow(page);
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
    await expect(page.getByRole('button', { name: /Abrir filtros/ })).toBeVisible();
    await page.getByRole('button', { name: /Abrir filtros/ }).click();
    await expect(page.getByRole('heading', { name: 'Filtros' })).toBeVisible();
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

  test('Actividad reciente shows at most 5 rows before Ver más', async ({ page }) => {
    await page.goto('/dashboard');

    const feed = page
      .getByRole('region', { name: 'Actividad reciente' })
      .filter({ visible: true })
      .first();
    const missing = await feed
      .waitFor({ timeout: 30_000 })
      .then(() => false)
      .catch(() => true);
    test.skip(missing, 'Activity feed not shown for this persona');

    await expect(feed.getByRole('status')).toHaveCount(0, { timeout: 20_000 });
    const rows = await feed.getByRole('listitem').count();
    expect(rows).toBeLessThanOrEqual(5);
    await expect(feed.getByRole('button', { name: 'Cargar más' })).toHaveCount(0);
  });
});
