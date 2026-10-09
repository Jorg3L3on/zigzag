import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {
  e2eCredentialsSkipReason,
  ensureTenantCompany,
  hasE2eCredentials,
  login,
} from './helpers/auth';

/**
 * ZIG-I5-6 accessibility gate for presupuestos (read-only: no saves). Same
 * policy as the other a11y specs: fail on serious/critical WCAG A/AA
 * violations; color-contrast stays disabled until the palette work lands.
 */
const expectNoSeriousViolations = async (page: Page) => {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .disableRules(['color-contrast'])
    .analyze();
  const violations = results.violations.filter(
    (violation) => violation.impact === 'serious' || violation.impact === 'critical',
  );
  expect(
    violations,
    `axe violations: ${violations.map((v) => `${v.id} (${v.impact})`).join(', ')}`,
  ).toEqual([]);
};

test.describe('Presupuestos accessibility @375px', () => {
  test.setTimeout(120_000);

  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
    await login(page);
    await ensureTenantCompany(page);
  });

  test('list, detail and review have no serious axe violations', async ({ page }) => {
    await page.goto('/presupuestos');
    await expect(
      page.getByRole('link', { name: 'Nuevo presupuesto' }).first(),
    ).toBeVisible({ timeout: 15_000 });
    await expectNoSeriousViolations(page);

    const firstRow = page.getByTestId('presupuesto-row').first();
    const hasRows = (await firstRow.count()) > 0;
    test.skip(!hasRows, 'No presupuestos for this tenant yet');
    const href = await firstRow.getByRole('link').first().getAttribute('href');
    expect(href).toMatch(/^\/presupuestos\/\d+$/);

    await page.goto(href!);
    await expect(page.getByTestId('presupuesto-status').first()).toBeVisible({
      timeout: 15_000,
    });
    await expectNoSeriousViolations(page);

    await page.goto(`${href}/listo`);
    await expect(page.getByTestId('review-header').first()).toBeVisible({
      timeout: 15_000,
    });
    await expectNoSeriousViolations(page);
  });

  test('composer and the Nuevo line sheet have no serious axe violations (cancel, no save)', async ({
    page,
  }) => {
    await page.goto('/presupuestos/create');
    await expect(
      page.getByRole('heading', { name: 'Cliente', exact: true }),
    ).toBeVisible({ timeout: 15_000 });
    await expectNoSeriousViolations(page);

    await page.getByRole('button', { name: 'Agregar servicio' }).click();
    const sheet = page.getByRole('dialog', { name: 'Agregar servicio' });
    await expect(sheet).toBeVisible();
    await sheet.getByRole('radio', { name: /Nuevo/ }).click();
    await expect(sheet.getByLabel('Nombre del servicio')).toBeVisible();
    await expectNoSeriousViolations(page);
    await sheet.getByRole('button', { name: 'Cancelar' }).click();
  });
});
