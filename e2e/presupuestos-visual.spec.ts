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
 * gains quotes. The composer shot cancels before saving. The list and detail
 * shots use the same fixture presupuesto (one inline line, no Vence, open):
 * the list is filtered to it and the detail opens it. It is created once on a
 * database that does not have it yet (ZIG-13).
 *
 * Update snapshots:
 *   npm run test:e2e:visual:update -- e2e/presupuestos-visual.spec.ts
 */
const FIXTURE_CLIENT = 'Presupuesto visual E2E';
const LINES_LABEL = 'Servicios del presupuesto';

/** Lists presupuestos filtered by the list search to the fixture's client. */
const searchFixture = async (page: Page) => {
  await page.goto('/presupuestos');
  await expect(page.getByRole('group', { name: 'Filtrar por estado' })).toBeVisible({
    timeout: 15_000,
  });
  const search = page
    .getByRole('textbox', { name: /Buscar presupuestos/ })
    .filter({ visible: true })
    .first();
  // A fill before hydration is wiped when React takes over; retry until the
  // search is applied (its chip shows).
  await expect(async () => {
    await search.fill(FIXTURE_CLIENT);
    await expect(page.getByText(`Búsqueda: ${FIXTURE_CLIENT}`).first()).toBeVisible({
      timeout: 2_000,
    });
  }).toPass({ timeout: 20_000 });
  return page
    .getByTestId('presupuesto-row')
    .filter({ visible: true })
    .filter({ hasText: FIXTURE_CLIENT })
    .first();
};

/**
 * Returns the fixture's detail URL, creating it through the composer the first
 * time (any tenant, even one without presupuestos).
 */
const ensureFixturePresupuesto = async (page: Page): Promise<string> => {
  await page.goto('/presupuestos');
  const filters = page.getByRole('group', { name: 'Filtrar por estado' });
  const emptyState = page.getByRole('heading', { name: 'Sin presupuestos' });
  await expect(filters.or(emptyState).first()).toBeVisible({ timeout: 15_000 });

  // A tenant without presupuestos shows an empty state with no search.
  if (await filters.isVisible()) {
    const row = await searchFixture(page);
    const exists = await row
      .waitFor({ timeout: 10_000 })
      .then(() => true)
      .catch(() => false);
    if (exists) {
      return (await row.getByRole('link').first().getAttribute('href'))!;
    }
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
  return `/presupuestos/${id}`;
};

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`Presupuestos visual (${colorScheme})`, () => {
    // Reduced motion: BlurFade (framer-motion) snaps to its final state, so a
    // shot never lands mid-entrance (Playwright only freezes CSS animations).
    test.use({
      viewport: { width: 375, height: 812 },
      colorScheme,
      contextOptions: { reducedMotion: 'reduce' },
    });
    test.setTimeout(180_000);

    test.beforeEach(async ({ page }) => {
      test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
      await login(page);
      await ensureTenantCompany(page);
    });

    test('list', async ({ page }) => {
      // Filtered to the fixture so the shot shows one row in any tenant.
      await ensureFixturePresupuesto(page);
      await expect(await searchFixture(page)).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId('presupuesto-row').filter({ visible: true })).toHaveCount(1);
      // Cards lift 2px on hover (hover-lift); keep the pointer off them.
      await page.mouse.move(0, 0);
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
      await page.goto(await ensureFixturePresupuesto(page));
      await expect(page.getByTestId('presupuesto-status').first()).toBeVisible({
        timeout: 15_000,
      });
      await page.mouse.move(0, 0);
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
