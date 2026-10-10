import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {
  e2eCredentialsSkipReason,
  ensureTenantCompany,
  hasE2eCredentials,
  login,
} from './helpers/auth';

/**
 * ZIG-I9: Abrir PDF on the presupuesto detail opens the in-app viewer (app bar
 * with a back arrow) instead of a raw PDF in a new tab. Read-only: no saves.
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

test.describe('Presupuesto PDF viewer @375px', () => {
  test.setTimeout(120_000);

  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
    await login(page);
    await ensureTenantCompany(page);
  });

  test('Abrir PDF stays in the app and back returns to the detail', async ({ page }) => {
    await page.goto('/presupuestos');
    const firstRow = page.getByTestId('presupuesto-row').first();
    await expect(
      page.getByRole('link', { name: 'Nuevo presupuesto' }).first(),
    ).toBeVisible({ timeout: 15_000 });
    test.skip((await firstRow.count()) === 0, 'No presupuestos for this tenant yet');
    const href = await firstRow.getByRole('link').first().getAttribute('href');
    expect(href).toMatch(/^\/presupuestos\/\d+$/);

    await page.goto(href!);
    const openPdf = page.getByRole('link', { name: /Abrir PDF/ });
    await expect(openPdf).toBeVisible({ timeout: 15_000 });
    await expect(openPdf).not.toHaveAttribute('target', /.+/);
    await openPdf.click();

    await expect(page).toHaveURL(new RegExp(`${href}/pdf$`));
    await expect(page.getByTestId('mobile-app-bar')).toBeVisible();
    await expect(page.getByTestId('mobile-app-bar')).toContainText(/Presupuesto #\d+/);
    await expectNoSeriousViolations(page);

    await page.getByRole('link', { name: 'Volver al presupuesto' }).first().click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    await expect(page.getByTestId('presupuesto-status').first()).toBeVisible();
  });
});
