import { test, expect } from '@playwright/test';
import { e2eCredentialsSkipReason, ensureTenantCompany, hasE2eCredentials, login } from './helpers/auth';
import { expectNoSeriousViolations } from './helpers/a11y';

/**
 * ZIG-I28-6: axe at 1280 on the four desktop screens this initiative redraws.
 * Uses tickets and a presupuesto that already exist for the tenant.
 */
test.describe('Receipt desktop axe @1280px', () => {
  test.use({ viewport: { width: 1280, height: 900 } });
  test.setTimeout(180_000);

  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
    await login(page);
    await ensureTenantCompany(page);
  });

  test('list, finished ticket, in-progress ticket and presupuesto have no serious violations', async ({
    page,
  }) => {
    await page.goto('/tickets');
    await expect(page.getByRole('navigation', { name: 'Vistas de tickets' })).toBeVisible({
      timeout: 15_000,
    });
    await expectNoSeriousViolations(page, 'tickets-list');

    const openTicket = async (path: string, rowText: RegExp) => {
      await page.goto(path);
      const row = page.getByRole('row').filter({ hasText: rowText }).first();
      await expect(row).toBeVisible({ timeout: 15_000 });
      // Row actions name the folio since #615, so open the ticket by clicking its row.
      await row.locator('td').first().click();
      await page.waitForURL(/\/tickets\/\d+$/, { timeout: 15_000 });
    };

    await openTicket('/tickets?finished=no', /En proceso/);
    await expect(page.getByRole('button', { name: 'Terminar ticket' }).first()).toBeVisible({
      timeout: 15_000,
    });
    await expectNoSeriousViolations(page, 'ticket-en-proceso');

    await openTicket('/tickets?status=paid', /Pagado/);
    await expect(page.getByTestId('ticket-collect-card').filter({ visible: true }).first()).toBeVisible({
      timeout: 15_000,
    });
    await expectNoSeriousViolations(page, 'ticket-terminado');

    // From md the list is a table (ZIG-I29-3); its rows open the detail.
    await page.goto('/presupuestos?estado=todos');
    const quote = page.getByTestId('presupuesto-table-row').first();
    await expect(quote).toBeVisible({ timeout: 15_000 });
    await quote.click();
    await page.waitForURL(/\/presupuestos\/\d+$/, { timeout: 15_000 });
    await expect(page.getByText('P. unitario').first()).toBeVisible({ timeout: 15_000 });
    await expectNoSeriousViolations(page, 'presupuesto');
  });
});
