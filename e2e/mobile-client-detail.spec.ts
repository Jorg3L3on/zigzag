import { test, expect } from '@playwright/test';
import {
  e2eCredentialsSkipReason,
  ensureTenantCompany,
  hasE2eCredentials,
  login,
} from './helpers/auth';
import { expectNoSeriousViolations } from './helpers/a11y';
import { expectLayoutIntact, MOBILE_WIDTHS } from './helpers/layout';

/**
 * ZIG-I17-1..3: the client detail page (history, balance, notes) and the ways in
 * from the client list and cobranza. Reads the demo company; the only write is
 * the notes of one client.
 */

for (const width of MOBILE_WIDTHS) {
  test.describe(`Client detail @${width}px`, () => {
    test.use({ viewport: { width, height: 812 } });

    test.beforeEach(async ({ page }) => {
      test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
      await login(page);
      await ensureTenantCompany(page);
    });

    test('opens from the client list and shows data, balance, history and notes', async ({
      page,
    }) => {
      await page.goto('/clients');
      const card = page.getByRole('button', { name: /Abrir cliente/i }).first();
      await expect(card).toBeVisible({ timeout: 30_000 });
      await card.click();

      await expect(page).toHaveURL(/\/clients\/\d+$/);
      await expect(page.getByTestId('client-detail-title')).toBeVisible();
      await expect(page.getByTestId('client-balance')).toBeVisible();
      for (const section of ['tickets', 'presupuestos', 'pagos', 'recordatorios']) {
        await expect(page.getByTestId(`client-section-${section}`)).toBeVisible();
      }
      await expect(page.getByTestId('client-notes')).toBeVisible();

      await expectLayoutIntact(page, 'client-detail');
      await expectNoSeriousViolations(page, 'client-detail');
    });

    test('saves notes and keeps them after a reload', async ({ page }) => {
      await page.goto('/clients');
      await page.getByRole('button', { name: /Abrir cliente/i }).first().click();
      await expect(page).toHaveURL(/\/clients\/\d+$/);

      const note = `Portón azul, tocar dos veces ${Date.now().toString().slice(-6)}`;
      const input = page.getByRole('textbox', { name: 'Notas del cliente' });
      await input.fill(note);
      await page.getByRole('button', { name: 'Guardar notas' }).click();
      await expect(page.getByText('Notas guardadas')).toBeVisible();

      await page.reload();
      await expect(page.getByRole('textbox', { name: 'Notas del cliente' })).toHaveValue(note);
    });

    test('the balance links to cobranza filtered by that client', async ({ page }) => {
      await page.goto('/cobranza');
      // The desktop table is hidden on a phone: take the visible card link.
      const link = page
        .locator('a[href^="/clients/"]')
        .filter({ visible: true })
        .first();
      await expect(link).toBeVisible({ timeout: 30_000 });
      await link.click();
      await expect(page).toHaveURL(/\/clients\/\d+$/);

      const cobranzaLink = page.getByTestId('client-balance-cobranza-link');
      await expect(cobranzaLink).toBeVisible();
      await cobranzaLink.click();

      await expect(page).toHaveURL(/\/cobranza\?clientId=\d+/);
      await expect(page.getByTestId('cobranza-client-filter')).toBeVisible();
    });
  });
}
