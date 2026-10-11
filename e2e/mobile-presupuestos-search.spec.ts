import { test, expect } from '@playwright/test';
import {
  e2eCredentialsSkipReason,
  ensureTenantCompany,
  hasE2eCredentials,
  login,
} from './helpers/auth';

/**
 * ZIG-I8-3: the presupuestos list has a search box (cliente, #id, teléfono).
 * Read-only: types into the box, never saves anything.
 */
test.describe('Presupuestos search @375px', () => {
  test.setTimeout(120_000);

  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
    await login(page);
    await ensureTenantCompany(page);
  });

  test('typing filters the rows and the input keeps focus and value', async ({ page }) => {
    await page.goto('/presupuestos');

    const rows = page.getByTestId('presupuesto-row').filter({ visible: true });
    const firstRow = rows.first();
    const hasRows = await firstRow
      .waitFor({ timeout: 20_000 })
      .then(() => true)
      .catch(() => false);
    test.skip(!hasRows, 'No open presupuestos for the E2E tenant');

    const total = await rows.count();
    const clientName = (
      await firstRow.locator('span.truncate').first().innerText()
    ).trim();
    const term = clientName.split(/\s+/)[0] ?? clientName;

    const search = page
      .getByRole('textbox', { name: /Buscar presupuestos/ })
      .filter({ visible: true })
      .first();
    await search.click();
    await search.pressSequentially(term);

    await expect(search).toBeFocused();
    await expect(search).toHaveValue(term);
    await expect(page.getByText(`Búsqueda: ${term}`).first()).toBeVisible();

    const matching = await rows.count();
    expect(matching).toBeGreaterThan(0);
    expect(matching).toBeLessThanOrEqual(total);
    for (const text of await rows.locator('span.truncate').allInnerTexts()) {
      expect(text.toLowerCase()).toContain(term.toLowerCase());
    }

    await search.fill('zzz-sin-coincidencias');
    await expect(page.getByText('Sin resultados')).toBeVisible();
    await expect(search).toBeFocused();
    await page.getByRole('button', { name: 'Limpiar búsqueda' }).click();
    await expect(rows).toHaveCount(total);
  });
});
