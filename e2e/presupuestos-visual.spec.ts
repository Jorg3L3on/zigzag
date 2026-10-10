import { test, expect, type Page } from '@playwright/test';
import {
  e2eCredentialsSkipReason,
  ensureTenantCompany,
  hasE2eCredentials,
  login,
} from './helpers/auth';
import {
  addInlineComposerLine,
  createClientInComposer,
} from './helpers/ticket-composer';

/**
 * ZIG-I5-6 visual baselines for presupuestos at 375px, light and dark.
 * Data-bearing regions are masked so baselines do not drift as the tenant
 * gains quotes. The composer shot cancels before saving. The detail shot
 * always opens the same fixture presupuesto (one inline line, no Vence, open)
 * and creates it once on a database that does not have it yet (ZIG-13).
 *
 * Update snapshots:
 *   npm run test:e2e:visual:update -- e2e/presupuestos-visual.spec.ts
 */
const FIXTURE_CLIENT = 'Presupuesto visual E2E';
const LINES_LABEL = 'Servicios del presupuesto';

/** Finds the fixture through the list search; creates it the first time. */
const openFixturePresupuesto = async (page: Page) => {
  await page.goto('/presupuestos');
  await expect(page.getByRole('group', { name: 'Filtrar por estado' })).toBeVisible({
    timeout: 15_000,
  });
  const search = page
    .getByRole('textbox', { name: /Buscar presupuestos/ })
    .filter({ visible: true })
    .first();
  await search.fill(FIXTURE_CLIENT);
  const row = page
    .getByTestId('presupuesto-row')
    .filter({ visible: true })
    .filter({ hasText: FIXTURE_CLIENT })
    .first();
  const exists = await row
    .waitFor({ timeout: 10_000 })
    .then(() => true)
    .catch(() => false);

  if (exists) {
    const href = await row.getByRole('link').first().getAttribute('href');
    await page.goto(href!);
    return;
  }

  await page.goto('/presupuestos/create');
  await expect(page.getByRole('heading', { name: 'Cliente', exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await createClientInComposer(page, {
    name: FIXTURE_CLIENT,
    phone: `555${Date.now().toString().slice(-7)}`,
  });
  await addInlineComposerLine(
    page,
    { name: 'Mantenimiento preventivo', price: 850 },
    LINES_LABEL,
  );
  await page.getByRole('button', { name: 'Guardar presupuesto' }).first().click();
  await page.waitForURL(/\/presupuestos\/\d+\/listo$/, { timeout: 60_000 });
  const id = page.url().match(/\/presupuestos\/(\d+)/)?.[1];
  await page.goto(`/presupuestos/${id}`);
};

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`Presupuestos visual (${colorScheme})`, () => {
    test.use({ viewport: { width: 375, height: 812 }, colorScheme });
    test.setTimeout(180_000);

    test.beforeEach(async ({ page }) => {
      test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
      await login(page);
      await ensureTenantCompany(page);
    });

    test('list', async ({ page }) => {
      await page.goto('/presupuestos');
      await expect(
        page.getByRole('group', { name: 'Filtrar por estado' }),
      ).toBeVisible({ timeout: 15_000 });
      await expect(page).toHaveScreenshot(`presupuestos-list-${colorScheme}.png`, {
        fullPage: false,
        mask: [
          page.getByTestId('presupuesto-row'),
          page.getByRole('group', { name: 'Filtrar por estado' }),
        ],
      });
    });

    test('composer with the Nuevo line sheet', async ({ page }) => {
      await page.goto('/presupuestos/create');
      await expect(
        page.getByRole('heading', { name: 'Cliente', exact: true }),
      ).toBeVisible({ timeout: 15_000 });
      await page.getByRole('button', { name: 'Agregar servicio' }).click();
      const sheet = page.getByRole('dialog', { name: 'Agregar servicio' });
      await sheet.getByRole('radio', { name: /Nuevo/ }).click();
      await sheet.getByLabel('Nombre del servicio').fill('Cambio de capacitor 35 µF');
      await sheet.getByRole('spinbutton', { name: 'Precio del servicio' }).fill('850');
      await page.waitForTimeout(600);
      await expect(page).toHaveScreenshot(`presupuestos-line-sheet-${colorScheme}.png`, {
        fullPage: false,
        mask: [page.getByRole('button', { name: /^Hoy ·|de \w+/ })],
      });
      await sheet.getByRole('button', { name: 'Cancelar' }).click();
    });

    test('detail', async ({ page }) => {
      await openFixturePresupuesto(page);
      await expect(page.getByTestId('presupuesto-status').first()).toBeVisible({
        timeout: 15_000,
      });
      await page.waitForTimeout(800);
      await expect(page).toHaveScreenshot(`presupuestos-detail-${colorScheme}.png`, {
        fullPage: false,
        mask: [
          page.getByTestId('presupuesto-header'),
          page.locator('section').filter({ hasText: 'Cliente' }),
          page.getByRole('list', { name: 'Servicios del presupuesto' }),
          page.getByTestId('review-total'),
          page.getByTestId('presupuesto-summary'),
          page.getByTestId('presupuesto-pdf-preview'),
          page.getByText(/^\$[\d,]+\.\d{2}$/),
          page.getByText(/^Presupuesto #\d+$/),
          // App bar subtitle `cliente · fecha`: the fixture's date differs per database.
          page.getByText(FIXTURE_CLIENT, { exact: false }),
        ],
      });
    });
  });
}
