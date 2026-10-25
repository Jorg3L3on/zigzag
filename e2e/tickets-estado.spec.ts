import { test, expect } from '@playwright/test';
import {
  e2eCredentialsSkipReason,
  ensureTenantCompany,
  hasE2eCredentials,
  login,
} from './helpers/auth';

test.describe('Tickets list Estado column', () => {
  test.setTimeout(180_000);

  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
    await login(page);
    await ensureTenantCompany(page);
  });

  test('shows a one-line estado chip, Trabajo and Saldo (ZIG-I28-4)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/tickets');
    await expect(page.getByPlaceholder('Buscar por cliente, folio o teléfono')).toBeVisible({
      timeout: 15_000,
    });

    const table = page.locator('table').first();
    await expect(table).toBeVisible({ timeout: 15_000 });
    await expect(table.getByRole('columnheader', { name: /Trabajo/i })).toBeVisible();
    await expect(table.getByRole('columnheader', { name: /Saldo/i })).toBeVisible();
    await expect(table.getByRole('columnheader', { name: /Estado/i })).toBeVisible();
    await expect(table.getByTestId('ticket-payment-summary')).toHaveCount(0);

    const chips = table.getByTestId('ticket-list-estado');
    await expect(chips.first()).toBeVisible({ timeout: 15_000 });
    const count = await chips.count();
    for (let i = 0; i < count; i += 1) {
      const label = (await chips.nth(i).innerText()).trim();
      expect(['Pagado', 'Pago parcial', 'Pendiente', 'En proceso']).toContain(label);
    }

    const views = page.getByRole('navigation', { name: 'Vistas de tickets' });
    await views.getByRole('button', { name: /^Por cobrar/ }).click();
    await expect(page).toHaveURL(/status=due/);
    await views.getByRole('button', { name: /^En proceso/ }).click();
    await expect(page).toHaveURL(/finished=no/);
    await views.getByRole('button', { name: /^Todos/ }).click();
    await expect(page).not.toHaveURL(/status=due/);
    await expect(page).not.toHaveURL(/finished=no/);
  });

  test('mobile cards show Pagado and Saldo once something is paid, Total otherwise (ZIG-I13-7)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/tickets');
    await expect(page.getByPlaceholder('Cliente, número de ticket o teléfono')).toBeVisible({
      timeout: 15_000,
    });

    // The desktop table stays in the DOM (hidden by CSS) with its own summaries.
    const summaries = page
      .getByTestId('ticket-payment-summary')
      .filter({ visible: true });
    await expect(summaries.first()).toBeVisible({ timeout: 15_000 });
    const count = await summaries.count();

    for (let i = 0; i < count; i += 1) {
      const summary = summaries.nth(i);
      await expect(summary.getByText(/\b\d+%/)).toHaveCount(0);
      const status = await summary.getAttribute('data-payment-status');
      if (status === 'partial') {
        await expect(summary.getByText(/^Pagado /)).toBeVisible();
        await expect(summary.getByText(/^Saldo /)).toBeVisible();
      } else {
        await expect(summary.getByText('Total')).toBeVisible();
        await expect(summary.getByText(/^Saldo /)).toHaveCount(0);
      }
    }
  });
});
